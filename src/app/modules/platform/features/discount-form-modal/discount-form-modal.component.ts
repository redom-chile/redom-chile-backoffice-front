import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { filter, map, Observable, startWith, switchMap } from 'rxjs';
import { resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import {
  DISCOUNT_DURATION_LABELS,
  DiscountDto,
  DiscountDuration,
  DiscountType,
  endOfDayInSantiago,
  getPlatformErrorMessage,
  INTERVAL_LABELS,
  PlanInterval,
  PlatformPlanDto,
  PlatformService,
  SaveDiscountDto,
  toSantiagoDateInput,
} from '../../data-access';
import { DiscountBusinessPickerComponent, PickedBusiness } from '../discount-business-picker';
import { DISCOUNT_CODE_PATTERN, discountIsLocked, startOfDayInSantiago } from '../discount-format';

/** Sin descuento: crear; con descuento: editar. `plans` evita volver a pedirlos si la página ya los tiene. */
export type DiscountFormModalData = Readonly<{ discount?: DiscountDto; plans?: readonly PlatformPlanDto[] }>;

type Field = 'code' | 'name' | 'value' | 'durationPeriods' | 'maxRedemptions' | 'dates';

const DURATIONS: DiscountDuration[] = ['once', 'repeating', 'forever'];
const INTERVALS: PlanInterval[] = ['month', 'year'];
const NAME_MAX = 100;

/** Lo que se compara para saber qué cambió (y lo que se envía al crear). */
type Normalized = Readonly<{
  code: string | null;
  name: string;
  type: DiscountType;
  value: number;
  duration: DiscountDuration;
  durationPeriods: number | null;
  planIds: number[] | null;
  intervals: PlanInterval[] | null;
  businessIds: number[] | null;
  maxRedemptions: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}>;

const sorted = <T extends number | string>(list: readonly T[] | null): T[] | null => (list?.length ? [...list].sort() : null);
const sameList = (a: readonly unknown[] | null, b: readonly unknown[] | null) => JSON.stringify(a) === JSON.stringify(b);
const isBlank = (value: unknown) => value === null || value === undefined || value === '';

/** Crear o editar un descuento. Devuelve el descuento guardado (undefined = cancelado). */
@Component({
  selector: 'app-discount-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, DiscountBusinessPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discount-form-modal.component.html',
})
export class DiscountFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<DiscountFormModalComponent, DiscountDto>>(MatDialogRef);
  readonly #data = inject<DiscountFormModalData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly #platform = inject(PlatformService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #fb = inject(FormBuilder);

  readonly discount = this.#data?.discount ?? null;
  readonly isLocked = !!this.discount && discountIsLocked(this.discount);
  readonly durations = DURATIONS;
  readonly durationLabels = DISCOUNT_DURATION_LABELS;
  readonly intervals = INTERVALS;
  readonly intervalLabels = INTERVAL_LABELS;
  readonly nameMax = NAME_MAX;

  readonly form = this.#fb.group({
    code: this.#fb.nonNullable.control(this.discount?.code ?? ''),
    name: this.#fb.nonNullable.control(this.discount?.name ?? ''),
    type: this.#fb.nonNullable.control<DiscountType>(this.discount?.type ?? 'percent'),
    value: this.#fb.control<number | null>(this.discount?.value ?? null),
    duration: this.#fb.nonNullable.control<DiscountDuration>(this.discount?.duration ?? 'once'),
    durationPeriods: this.#fb.control<number | null>(this.discount?.durationPeriods ?? null),
    planIds: this.#fb.nonNullable.control<number[]>([...(this.discount?.planIds ?? [])]),
    intervals: this.#fb.nonNullable.control<PlanInterval[]>([...(this.discount?.intervals ?? [])]),
    maxRedemptions: this.#fb.control<number | null>(this.discount?.maxRedemptions ?? null),
    validFrom: this.#fb.nonNullable.control(toSantiagoDateInput(this.discount?.validFrom)),
    validUntil: this.#fb.nonNullable.control(toSantiagoDateInput(this.discount?.validUntil)),
    isActive: this.#fb.nonNullable.control(this.discount?.isActive ?? true),
  });
  readonly $value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Ids guardados con un nombre provisorio hasta encontrarlos en el listado de negocios. */
  readonly $businesses = signal<PickedBusiness[]>((this.discount?.businessIds ?? []).map((id) => ({ id, name: `Negocio #${id}` })));

  readonly #plansResource = rxResource({
    params: () => (this.#data?.plans ? undefined : true),
    stream: () => this.#platform.getPlans().pipe(toRemoteResult()),
  });
  readonly $plans = computed(() => this.#data?.plans ?? resultValue(this.#plansResource.value()) ?? []);
  readonly $plansLoading = computed(() => !this.#data?.plans && this.#plansResource.isLoading());
  /** Planes pagados, más los que ya estaban elegidos. */
  readonly $planOptions = computed(() => {
    const selected = this.$value().planIds;
    return this.$plans().filter((plan) => !plan.isFree || selected.includes(plan.id));
  });

  // No hay filtro por id: se buscan los nombres en la primera página grande del listado.
  readonly #businessNames = rxResource({
    params: () => (this.discount?.businessIds?.length ? true : undefined),
    stream: () => this.#platform.getBusinesses({ perPage: 100 }).pipe(toRemoteResult()),
  });

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);

  readonly $problems = computed(() => this.#problems());
  readonly $changes = computed(() => this.#changes());

  constructor() {
    if (this.isLocked) {
      for (const name of ['type', 'value', 'duration', 'durationPeriods'] as const) this.form.controls[name].disable();
    }
    effect(() => {
      const found = resultValue(this.#businessNames.value())?.data ?? [];
      if (!found.length) return;
      untracked(() =>
        this.$businesses.update((list) => list.map((business) => ({ id: business.id, name: found.find((item) => item.id === business.id)?.name ?? business.name }))),
      );
    });
  }

  show(field: Field): string | null {
    const message = this.$problems()[field] ?? null;
    if (!message) return null;
    if (this.$submitted()) return message;
    const controls = field === 'dates' ? (['validFrom', 'validUntil'] as const) : ([field] as const);
    return controls.some((name) => this.form.controls[name].touched) ? message : null;
  }

  handleCodeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toUpperCase().replace(/\s+/g, '');
    if (upper !== input.value) {
      const caret = input.selectionStart;
      this.form.controls.code.setValue(upper);
      input.value = upper;
      if (caret !== null) input.setSelectionRange(caret, caret);
    }
  }

  togglePlan(id: number, checked: boolean) {
    const control = this.form.controls.planIds;
    control.setValue(checked ? [...control.value, id] : control.value.filter((item) => item !== id));
    control.markAsDirty();
  }

  toggleInterval(interval: PlanInterval, checked: boolean) {
    const control = this.form.controls.intervals;
    control.setValue(checked ? [...control.value, interval] : control.value.filter((item) => item !== interval));
    control.markAsDirty();
  }

  handleClose() {
    this.dialogRef.close();
  }

  handleDeactivate() {
    const discount = this.discount;
    if (!discount || this.$isSaving()) return;
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Desactivar descuento',
          message: `"${discount.name}" ya no se podrá aplicar a nuevas suscripciones. Las que ya lo tienen lo mantienen. Después puedes crear otro con los términos nuevos.`,
          confirmText: 'Desactivar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$isSaving.set(true);
          return this.#platform.updateDiscount(discount.id, { isActive: false });
        }),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.#toast.show('Descuento desactivado', 'success');
          this.dialogRef.close(saved);
        },
        error: (error: unknown) => this.#fail(error),
      });
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    const discount = this.discount;
    let request: Observable<DiscountDto>;
    if (discount) {
      const dto = this.$changes();
      if (!Object.keys(dto).length) {
        this.#toast.show('No hay cambios que guardar', 'warning');
        this.dialogRef.close();
        return;
      }
      request = this.#platform.updateDiscount(discount.id, dto);
    } else {
      request = this.#platform.createDiscount(this.#toDto(this.#normalized()));
    }
    this.$isSaving.set(true);
    request.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (saved) => {
        this.#toast.show(discount ? 'Descuento actualizado' : 'Descuento creado', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => this.#fail(error),
    });
  }

  #fail(error: unknown) {
    this.$isSaving.set(false);
    this.#toast.show(getPlatformErrorMessage(error, 'No se pudo guardar el descuento'), 'error');
  }

  #problems(): Partial<Record<Field, string>> {
    const v = this.$value();
    const problems: Partial<Record<Field, string>> = {};
    const code = v.code.trim().toUpperCase();
    if (code && !DISCOUNT_CODE_PATTERN.test(code)) problems.code = 'De 2 a 40 caracteres: letras, números, - o _ (sin espacios ni tildes).';
    const name = v.name.trim();
    if (!name) problems.name = 'Ingresa el nombre.';
    else if (name.length > NAME_MAX) problems.name = `Hasta ${NAME_MAX} caracteres.`;

    if (!this.isLocked) {
      const value = v.value;
      if (isBlank(value)) problems.value = v.type === 'percent' ? 'Ingresa el porcentaje.' : 'Ingresa el monto.';
      else if (v.type === 'percent' && (value! <= 0 || value! > 100 || Math.abs(Math.round(value! * 100) - value! * 100) > 1e-9))
        problems.value = 'Más de 0 y hasta 100, con hasta 2 decimales.';
      else if (v.type === 'amount' && (value! <= 0 || !Number.isInteger(value))) problems.value = 'Un monto entero en CLP mayor que 0.';
      if (v.duration === 'repeating' && (isBlank(v.durationPeriods) || !Number.isInteger(v.durationPeriods) || v.durationPeriods! < 1))
        problems.durationPeriods = 'Indica cuántos cobros (entero, 1 o más).';
    }

    if (!isBlank(v.maxRedemptions)) {
      const min = Math.max(1, this.discount?.redemptions ?? 0);
      if (!Number.isInteger(v.maxRedemptions) || v.maxRedemptions! < min)
        problems.maxRedemptions = min > 1 ? `Un entero desde ${min} (ya se usó ${min} veces).` : 'Un entero de 1 o más; déjalo vacío si es ilimitado.';
    }
    if (v.validFrom && v.validUntil && v.validFrom > v.validUntil) problems.dates = 'La fecha de inicio no puede ser posterior a la de término.';
    return problems;
  }

  #normalized(): Normalized {
    const v = this.$value();
    const intervals = v.intervals.length === 1 ? v.intervals : null;
    return {
      code: v.code.trim().toUpperCase() || null,
      name: v.name.trim(),
      type: v.type,
      value: Number(v.value),
      duration: v.duration,
      durationPeriods: v.duration === 'repeating' ? Number(v.durationPeriods) : null,
      planIds: sorted(v.planIds),
      intervals: sorted(intervals),
      businessIds: sorted(this.$businesses().map((business) => business.id)),
      maxRedemptions: isBlank(v.maxRedemptions) ? null : Number(v.maxRedemptions),
      validFrom: v.validFrom,
      validUntil: v.validUntil,
      isActive: v.isActive,
    };
  }

  #toDto(next: Normalized): SaveDiscountDto {
    return {
      ...next,
      validFrom: next.validFrom ? startOfDayInSantiago(next.validFrom) : null,
      validUntil: next.validUntil ? endOfDayInSantiago(next.validUntil) : null,
    };
  }

  /** Solo lo que cambió respecto del descuento guardado. */
  #changes(): SaveDiscountDto {
    const discount = this.discount;
    if (!discount) return {};
    const next = this.#normalized();
    const full = this.#toDto(next);
    const changes: Record<string, unknown> = {};
    if (next.code !== discount.code) changes['code'] = next.code;
    if (next.name !== discount.name) changes['name'] = next.name;
    if (!this.isLocked) {
      if (next.type !== discount.type || next.value !== discount.value) Object.assign(changes, { type: next.type, value: next.value });
      const periods = discount.duration === 'repeating' ? discount.durationPeriods : null;
      if (next.duration !== discount.duration || next.durationPeriods !== periods)
        Object.assign(changes, { duration: next.duration, durationPeriods: next.durationPeriods });
    }
    if (!sameList(next.planIds, sorted(discount.planIds))) changes['planIds'] = next.planIds;
    if (!sameList(next.intervals, sorted(discount.intervals?.length === 1 ? discount.intervals : null))) changes['intervals'] = next.intervals;
    if (!sameList(next.businessIds, sorted(discount.businessIds))) changes['businessIds'] = next.businessIds;
    if (next.maxRedemptions !== discount.maxRedemptions) changes['maxRedemptions'] = next.maxRedemptions;
    if (next.validFrom !== toSantiagoDateInput(discount.validFrom)) changes['validFrom'] = full.validFrom;
    if (next.validUntil !== toSantiagoDateInput(discount.validUntil)) changes['validUntil'] = full.validUntil;
    if (next.isActive !== discount.isActive) changes['isActive'] = next.isActive;
    return changes as SaveDiscountDto;
  }
}

export function openDiscountFormModal(dialog: MatDialog, data: DiscountFormModalData = {}): Observable<DiscountDto | undefined> {
  return dialog
    .open<DiscountFormModalComponent, DiscountFormModalData, DiscountDto>(DiscountFormModalComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
