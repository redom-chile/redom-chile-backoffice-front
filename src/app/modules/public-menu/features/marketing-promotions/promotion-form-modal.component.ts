import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { map, Observable, startWith } from 'rxjs';
import {
  CreatePromotionDto,
  MenuMarketingService,
  PriceChannel,
  PromotionDiscountType,
  PromotionDto,
  PromotionTargetType,
  UpdatePromotionDto,
} from 'src/app/modules/public-menu/data-access';
import {
  MarketingScheduleFieldComponent,
  sameSchedule,
  ScheduleFormValue,
  scheduleFromEntity,
  scheduleProblem,
  scheduleToDto,
} from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { MarketingLocation, marketingSaveError } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingTarget, MarketingTargetPickerComponent } from 'src/app/modules/public-menu/features/marketing-target-picker';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService, ToggleComponent } from 'src/ui';
import { DISCOUNT_TYPE_LABELS, TARGET_TYPE_LABELS, targetNameOf } from './promotion-format';

export type PromotionFormModalData = Readonly<{
  promotion?: PromotionDto;
  locations: readonly MarketingLocation[];
  timeZone: string | null;
  /** Local elegido en el filtro de la página (al crear). */
  locationId?: number | null;
  /** Al crear: valores sugeridos (por ejemplo, desde Mejorar mi carta). */
  draft?: PromotionDraft;
}>;

export type PromotionDraft = Readonly<{
  name: string;
  target: MarketingTarget;
  discountType: PromotionDiscountType;
  value: number;
  daysOfWeek?: readonly number[];
}>;

type Field = 'name' | 'target' | 'value' | 'channels' | 'schedule';

const NAME_MAX = 120;
const TARGET_TYPES: PromotionTargetType[] = ['product', 'variation', 'category'];
const DISCOUNT_TYPES: PromotionDiscountType[] = ['percent', 'amount', 'fixed_price'];
const CHANNELS: PriceChannel[] = ['in_store', 'online'];

/** Crear o editar una promoción. Devuelve la guardada (undefined = cancelado). */
@Component({
  selector: 'app-promotion-form-modal',
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective, ToggleComponent, MarketingScheduleFieldComponent, MarketingTargetPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './promotion-form-modal.component.html',
})
export class PromotionFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<PromotionFormModalComponent, PromotionDto>>(MatDialogRef);
  readonly data = inject<PromotionFormModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(MenuMarketingService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #fb = inject(FormBuilder);

  readonly promotion = this.data.promotion ?? null;
  readonly #draft = this.promotion ? null : (this.data.draft ?? null);
  readonly nameMax = NAME_MAX;
  readonly targetTypes = TARGET_TYPES;
  readonly targetLabels = TARGET_TYPE_LABELS;
  readonly discountTypes = DISCOUNT_TYPES;
  readonly discountLabels = DISCOUNT_TYPE_LABELS;
  readonly channels = CHANNELS;
  readonly channelLabels: Record<PriceChannel, string> = { in_store: 'En el local (caja y QR de mesa)', online: 'Online (retiro y delivery)' };

  readonly form = this.#fb.group({
    name: this.#fb.nonNullable.control(this.promotion?.name ?? this.#draft?.name ?? ''),
    targetType: this.#fb.nonNullable.control<PromotionTargetType>(this.promotion?.targetType ?? 'product'),
    discountType: this.#fb.nonNullable.control<PromotionDiscountType>(this.promotion?.discountType ?? this.#draft?.discountType ?? 'percent'),
    value: this.#fb.control<number | null>(this.promotion ? Number(this.promotion.value) : (this.#draft?.value ?? null)),
    locationId: this.#fb.nonNullable.control<string>(String(this.promotion ? (this.promotion.locationId ?? '') : (this.data.locationId ?? ''))),
  });
  readonly $value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  readonly $target = signal<MarketingTarget | null>(this.promotion ? { id: this.promotion.targetId, name: targetNameOf(this.promotion) } : (this.#draft?.target ?? null));
  readonly $channels = signal<PriceChannel[]>([...(this.promotion?.channels ?? CHANNELS)]);
  readonly $isActive = signal(this.promotion?.isActive ?? true);
  readonly #originalSchedule = scheduleFromEntity(this.promotion, this.data.timeZone);
  readonly $schedule = signal<ScheduleFormValue>(
    this.#draft?.daysOfWeek?.length ? { ...this.#originalSchedule, days: [...this.#draft.daysOfWeek] } : this.#originalSchedule,
  );

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $problems = computed(() => this.#problems());

  constructor() {
    // Otro tipo de destino: hay que volver a elegirlo.
    this.form.controls.targetType.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.$target.set(null));
  }

  show(field: Field): string | null {
    const message = this.$problems()[field] ?? null;
    if (!message) return null;
    if (this.$submitted() || field === 'schedule') return message;
    if (field === 'name' || field === 'value') return this.form.controls[field].touched ? message : null;
    return null;
  }

  toggleChannel(channel: PriceChannel, checked: boolean) {
    this.$channels.update((list) => (checked ? [...new Set([...list, channel])] : list.filter((item) => item !== channel)));
  }

  handleClose() {
    this.dialogRef.close();
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    let request: Observable<PromotionDto>;
    if (this.promotion) {
      const dto = this.#changes(this.promotion);
      if (!Object.keys(dto).length) {
        this.dialogRef.close();
        return;
      }
      request = this.#service.updatePromotion(this.promotion.id, dto);
    } else {
      request = this.#service.createPromotion(this.#createDto());
    }
    this.$isSaving.set(true);
    request.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (saved) => {
        this.#toast.show(this.promotion ? 'Promoción actualizada' : 'Promoción creada', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const message = marketingSaveError(error, 'No se pudo guardar la promoción.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  #problems(): Partial<Record<Field, string>> {
    const v = this.$value();
    const problems: Partial<Record<Field, string>> = {};
    const name = v.name.trim();
    if (!name) problems.name = 'Ingresa el nombre.';
    else if (name.length > NAME_MAX) problems.name = `Hasta ${NAME_MAX} caracteres.`;
    if (!this.$target()) problems.target = v.targetType === 'category' ? 'Elige la categoría.' : 'Elige a qué se aplica.';
    const value = v.value;
    if (value === null || (value as unknown) === '') problems.value = v.discountType === 'percent' ? 'Ingresa el porcentaje.' : 'Ingresa el monto.';
    else if (v.discountType === 'percent' && (value <= 0 || value > 100 || Math.abs(Math.round(value * 100) - value * 100) > 1e-9))
      problems.value = 'Más de 0 y hasta 100, con hasta 2 decimales.';
    else if (v.discountType !== 'percent' && (value <= 0 || !Number.isInteger(value))) problems.value = 'Un monto entero en CLP mayor que 0.';
    if (!this.$channels().length) problems.channels = 'Elige al menos un canal.';
    const schedule = scheduleProblem(this.$schedule());
    if (schedule) problems.schedule = schedule;
    return problems;
  }

  #locationId(): number | null {
    const raw = this.$value().locationId;
    return raw ? Number(raw) : null;
  }

  #createDto(): CreatePromotionDto {
    const v = this.$value();
    const schedule = scheduleToDto(this.$schedule(), this.data.timeZone);
    return {
      name: v.name.trim(),
      targetType: v.targetType,
      targetId: this.$target()!.id,
      discountType: v.discountType,
      value: Number(v.value),
      channels: this.#sortedChannels(),
      locationId: this.#locationId(),
      isActive: this.$isActive(),
      // Al crear no hace falta enviar lo vacío.
      ...Object.fromEntries(Object.entries(schedule).filter(([, value]) => value !== null)),
    };
  }

  #sortedChannels(): PriceChannel[] {
    return CHANNELS.filter((channel) => this.$channels().includes(channel));
  }

  /** Solo lo que cambió. */
  #changes(promotion: PromotionDto): UpdatePromotionDto {
    const v = this.$value();
    const changes: Record<string, unknown> = {};
    const name = v.name.trim();
    if (name !== promotion.name) changes['name'] = name;
    const target = this.$target()!;
    if (v.targetType !== promotion.targetType || target.id !== promotion.targetId) Object.assign(changes, { targetType: v.targetType, targetId: target.id });
    if (v.discountType !== promotion.discountType || Number(v.value) !== Number(promotion.value))
      Object.assign(changes, { discountType: v.discountType, value: Number(v.value) });
    const channels = this.#sortedChannels();
    if (channels.join() !== CHANNELS.filter((channel) => promotion.channels.includes(channel)).join()) changes['channels'] = channels;
    if (this.#locationId() !== promotion.locationId) changes['locationId'] = this.#locationId();
    if (this.$isActive() !== promotion.isActive) changes['isActive'] = this.$isActive();
    if (!sameSchedule(this.$schedule(), this.#originalSchedule)) Object.assign(changes, scheduleToDto(this.$schedule(), this.data.timeZone));
    return changes as UpdatePromotionDto;
  }
}

export function openPromotionFormModal(dialog: MatDialog, data: PromotionFormModalData): Observable<PromotionDto | undefined> {
  return dialog
    .open<PromotionFormModalComponent, PromotionFormModalData, PromotionDto>(PromotionFormModalComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
