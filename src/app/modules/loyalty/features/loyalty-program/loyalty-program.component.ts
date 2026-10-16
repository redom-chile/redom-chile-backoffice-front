import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import {
  formatLoyaltyDate,
  getLoyaltyErrorMessage,
  LoyaltyMechanic,
  LoyaltyProgramDto,
  LoyaltyService,
  SaveLoyaltyProgramDto,
  StampRule,
} from 'src/app/modules/loyalty/data-access';
import { LoyaltyTargetSelectComponent } from 'src/app/modules/loyalty/features/loyalty-target-select';
import { ButtonComponent, EmptyStateComponent, IconComponent, ToastService, ToggleComponent } from 'src/ui';

type Field = 'name' | 'points' | 'amountUnit' | 'stampRule' | 'stampMinAmount' | 'targets' | 'expireDays';

type FormState = {
  name: string;
  mechanic: LoyaltyMechanic;
  pointsPerUnit: number | null;
  amountUnit: number | null;
  stampRule: StampRule | null;
  stampMinAmount: number | null;
  stampTargetIds: number[];
  expires: boolean;
  expireDays: number | null;
  isActive: boolean;
};

const NAME_MAX = 80;

function toForm(program: LoyaltyProgramDto | null): FormState {
  return {
    name: program?.name ?? 'Club de clientes',
    mechanic: program?.mechanic ?? 'points',
    pointsPerUnit: program?.pointsPerUnit ?? 1,
    amountUnit: program?.amountUnit ?? 1000,
    stampRule: program?.stampRule ?? 'visit',
    stampMinAmount: program?.stampMinAmount ?? 0,
    stampTargetIds: [...(program?.stampTargetIds ?? [])],
    expires: program?.expireDays != null,
    expireDays: program?.expireDays ?? 365,
    isActive: program?.isActive ?? true,
  };
}

const isInt = (value: number | null): value is number => value !== null && Number.isInteger(value);
// Igual que el backend (IsNumber maxDecimalPlaces: 2).
const hasMaxDecimals = (value: number, places: number) => (String(value).split('.')[1]?.length ?? 0) <= places;

/** Pestaña Programa: mecánica de puntos o sellos, vencimiento y estado. */
@Component({
  selector: 'app-loyalty-program',
  imports: [ButtonComponent, EmptyStateComponent, IconComponent, ToggleComponent, LoyaltyTargetSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loyalty-program.component.html',
})
export class LoyaltyProgramComponent {
  readonly #service = inject(LoyaltyService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  /** null: aún no se crea. */
  readonly program = input.required<LoyaltyProgramDto | null>();
  readonly saved = output<LoyaltyProgramDto>();

  readonly nameMax = NAME_MAX;
  readonly formatDate = formatLoyaltyDate;
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.LOYALTY.MANAGE));

  readonly $form = linkedSignal(() => toForm(this.program()));
  // Sin programa se muestra primero el estado vacío.
  readonly $creating = signal(false);
  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $problems = computed(() => this.#problems(this.$form()));

  set<K extends keyof FormState>(key: K, value: FormState[K]) {
    this.$form.update((form) => ({ ...form, [key]: value }));
  }

  setNumber(key: 'pointsPerUnit' | 'amountUnit' | 'stampMinAmount' | 'expireDays', event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    this.set(key, raw === '' ? null : Number(raw));
  }

  setText(event: Event) {
    this.set('name', (event.target as HTMLInputElement).value);
  }

  setRule(rule: StampRule) {
    // Los ids de productos y categorías no se mezclan.
    this.$form.update((form) => ({ ...form, stampRule: rule, stampTargetIds: form.stampRule === rule ? form.stampTargetIds : [] }));
  }

  show(field: Field): string | null {
    return this.$submitted() ? (this.$problems()[field] ?? null) : null;
  }

  reset() {
    this.$form.set(toForm(this.program()));
    this.$submitted.set(false);
    this.$creating.set(false);
  }

  save() {
    if (this.$isSaving() || !this.$canManage()) return;
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) {
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    this.$isSaving.set(true);
    this.#service.saveProgram(this.#dto(this.$form())).subscribe({
      next: (program) => {
        const created = !this.program();
        this.$isSaving.set(false);
        this.$submitted.set(false);
        this.$creating.set(false);
        this.saved.emit(program);
        this.#toast.show(created ? 'Programa creado' : 'Programa guardado', 'success');
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const message = getLoyaltyErrorMessage(error, 'No se pudo guardar el programa.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  #dto(form: FormState): SaveLoyaltyProgramDto {
    const base = { name: form.name.trim(), mechanic: form.mechanic, expireDays: form.expires ? form.expireDays : null, isActive: form.isActive };
    if (form.mechanic === 'points') return { ...base, pointsPerUnit: form.pointsPerUnit!, amountUnit: form.amountUnit! };
    return {
      ...base,
      stampRule: form.stampRule,
      ...(form.stampRule === 'visit' ? { stampMinAmount: form.stampMinAmount ?? 0 } : { stampTargetIds: form.stampTargetIds }),
    };
  }

  #problems(form: FormState): Partial<Record<Field, string>> {
    const problems: Partial<Record<Field, string>> = {};
    const name = form.name.trim();
    if (!name) problems.name = 'Ingresa el nombre.';
    else if (name.length > NAME_MAX) problems.name = `Hasta ${NAME_MAX} caracteres.`;
    if (form.mechanic === 'points') {
      if (!isInt(form.pointsPerUnit) || form.pointsPerUnit < 1 || form.pointsPerUnit > 1000) problems.points = 'Entre 1 y 1.000 puntos.';
      if (form.amountUnit === null || !(form.amountUnit >= 1)) problems.amountUnit = 'Ingresa un monto de al menos $1.';
      else if (!hasMaxDecimals(form.amountUnit, 2)) problems.amountUnit = 'Usa hasta 2 decimales.';
    } else if (!form.stampRule) {
      problems.stampRule = 'Elige cómo se gana un sello.';
    } else if (form.stampRule === 'visit') {
      if (form.stampMinAmount === null || form.stampMinAmount < 0) problems.stampMinAmount = 'Ingresa un monto (0 = cualquier compra).';
    } else if (!form.stampTargetIds.length) {
      problems.targets = form.stampRule === 'product' ? 'Elige al menos un producto.' : 'Elige al menos una categoría.';
    }
    if (form.expires && (!isInt(form.expireDays) || form.expireDays < 7 || form.expireDays > 3650)) problems.expireDays = 'Entre 7 y 3.650 días.';
    return problems;
  }
}
