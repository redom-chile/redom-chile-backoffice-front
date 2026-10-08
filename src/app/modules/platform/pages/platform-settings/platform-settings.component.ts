import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { formatRut, rutValidator } from 'src/app/shared/validators';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  BankTransferInfoDto,
  formatPlatformDate,
  getPlatformErrorMessage,
  PlatformService,
  PlatformSettingsDto,
  UpdatePlatformSettingsDto,
} from '../../data-access';

const REMINDERS_MAX = 5;
const BANK_KEYS = ['bank', 'accountType', 'accountNumber', 'holderName', 'holderTaxId', 'email'] as const;
type BankKey = (typeof BANK_KEYS)[number];
type NumberField = 'trialDays' | 'graceDays';

const BANKS = [
  'Banco de Chile',
  'Banco Santander',
  'Banco Estado',
  'Banco BCI',
  'Banco Itaú',
  'Scotiabank',
  'Banco Security',
  'Banco BICE',
  'Banco Falabella',
  'Banco Ripley',
  'Banco Consorcio',
  'Banco Internacional',
  'Mercado Pago',
  'Tenpo',
];
const ACCOUNT_TYPES = ['Cuenta corriente', 'Cuenta vista', 'Cuenta de ahorro', 'Cuenta RUT'];

const sortReminders = (values: readonly number[]) => [...new Set(values)].sort((a, b) => b - a);
const sameList = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Ajustes globales: prueba, gracia, plan de respaldo, recordatorios y datos para transferencias. */
@Component({
  selector: 'app-platform-settings',
  imports: [ReactiveFormsModule, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-settings.component.html',
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class PlatformSettingsComponent {
  readonly #fb = inject(FormBuilder);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly banks = BANKS;
  readonly accountTypes = ACCOUNT_TYPES;
  readonly remindersMax = REMINDERS_MAX;
  readonly formatDate = formatPlatformDate;

  readonly form = this.#fb.group({
    trialDays: this.#fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(90), Validators.pattern(/^\d+$/)]),
    trialPlanCode: this.#fb.nonNullable.control('', Validators.required),
    trialRequiresCard: this.#fb.nonNullable.control(false),
    graceDays: this.#fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(60), Validators.pattern(/^\d+$/)]),
    fallbackPlanCode: this.#fb.nonNullable.control('', Validators.required),
    reminderDaysBefore: this.#fb.nonNullable.control<number[]>([]),
    bankTransferInfo: this.#fb.nonNullable.group({
      bank: this.#fb.nonNullable.control('', Validators.maxLength(100)),
      accountType: this.#fb.nonNullable.control('', Validators.maxLength(60)),
      accountNumber: this.#fb.nonNullable.control('', Validators.maxLength(40)),
      holderName: this.#fb.nonNullable.control('', Validators.maxLength(150)),
      holderTaxId: this.#fb.nonNullable.control('', [Validators.maxLength(20), rutValidator]),
      email: this.#fb.nonNullable.control('', [Validators.email, Validators.maxLength(150)]),
    }),
  });
  readonly $value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  // ---------- Datos ----------
  readonly #settingsResource = rxResource({ stream: () => this.#platform.getSettings().pipe(toRemoteResult()) });
  readonly #plansResource = rxResource({ stream: () => this.#platform.getPlans().pipe(toRemoteResult()) });
  /** Último estado guardado (se actualiza al guardar). */
  readonly $settings = signal<PlatformSettingsDto | null>(null);
  readonly $plans = computed(() => resultValue(this.#plansResource.value()) ?? []);
  readonly $loadError = computed(() => resultError(this.#settingsResource.value()) ?? resultError(this.#plansResource.value()));
  readonly $isLoading = computed(() => !this.$loadError() && (!this.$settings() || this.#plansResource.isLoading()));

  /** Planes pagados y activos (más el actual, por si ya no cumple). */
  readonly $trialPlans = computed(() => {
    const current = this.$settings()?.trialPlanCode;
    return this.$plans().filter((plan) => (!plan.isFree && plan.isActive) || plan.code === current);
  });
  /** Planes free y activos (más el actual). */
  readonly $fallbackPlans = computed(() => {
    const current = this.$settings()?.fallbackPlanCode;
    return this.$plans().filter((plan) => (plan.isFree && plan.isActive) || plan.code === current);
  });

  // ---------- Estado ----------
  readonly $reminderDraft = signal('');
  readonly $isSaving = signal(false);
  readonly $changes = computed(() => this.#changes());
  readonly $hasChanges = computed(() => Object.keys(this.$changes()).length > 0);

  constructor() {
    effect(() => {
      const settings = resultValue(this.#settingsResource.value());
      if (!settings) return;
      untracked(() => {
        if (!this.$settings()) this.#reset(settings);
      });
    });
  }

  invalid(name: NumberField | 'trialPlanCode' | 'fallbackPlanCode'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  invalidBank(name: BankKey): boolean {
    const control = this.form.controls.bankTransferInfo.controls[name];
    return control.invalid && control.touched;
  }

  planWarning(code: string, free: boolean): string | null {
    const plan = this.$plans().find((item) => item.code === code);
    if (!plan) return code ? 'El plan elegido ya no existe.' : null;
    if (!plan.isActive) return 'El plan elegido está inactivo: elige otro.';
    if (plan.isFree !== free) return free ? 'Debe ser un plan gratis.' : 'Debe ser un plan pagado.';
    return null;
  }

  handleReminderKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addReminder();
    }
  }

  addReminder() {
    const raw = this.$reminderDraft().trim();
    if (!raw) return;
    const day = Number(raw);
    const control = this.form.controls.reminderDaysBefore;
    if (!Number.isInteger(day) || day < 1 || day > 30) {
      this.#toast.show('Cada recordatorio es un número entero de 1 a 30 días', 'warning');
      return;
    }
    if (control.value.includes(day)) {
      this.$reminderDraft.set('');
      return;
    }
    if (control.value.length >= REMINDERS_MAX) {
      this.#toast.show(`Máximo ${REMINDERS_MAX} recordatorios`, 'warning');
      return;
    }
    control.setValue(sortReminders([...control.value, day]));
    control.markAsDirty();
    this.$reminderDraft.set('');
  }

  removeReminder(day: number) {
    const control = this.form.controls.reminderDaysBefore;
    control.setValue(control.value.filter((value) => value !== day));
    control.markAsDirty();
  }

  formatTaxId() {
    const control = this.form.controls.bankTransferInfo.controls.holderTaxId;
    if (control.value.trim() && control.valid) control.setValue(formatRut(control.value.trim()));
  }

  hasUnsavedChanges(): boolean {
    return this.$hasChanges();
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  getError(error: unknown): string {
    return getPlatformErrorMessage(error, 'Intenta nuevamente.');
  }

  retryLoad() {
    if (resultError(this.#settingsResource.value())) this.#settingsResource.reload();
    if (resultError(this.#plansResource.value())) this.#plansResource.reload();
  }

  handleDiscard() {
    const settings = this.$settings();
    if (settings) this.#reset(settings);
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    const dto = this.#changes(this.form.getRawValue());
    if (!Object.keys(dto).length) {
      this.#toast.show('No hay cambios que guardar', 'warning');
      return;
    }
    this.$isSaving.set(true);
    this.#platform
      .updateSettings(dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (saved) => {
          this.$isSaving.set(false);
          this.#reset(saved);
          this.#toast.show('Ajustes guardados', 'success');
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudieron guardar los ajustes'), 'error');
        },
      });
  }

  /** Solo lo que cambió; en los datos bancarios, solo los subcampos cambiados (vacío = null). */
  #changes(v = this.$value()): UpdatePlatformSettingsDto {
    const settings = this.$settings();
    if (!settings) return {};
    const dto: Record<string, unknown> = {};
    const trialDays = Number(v.trialDays);
    if (v.trialDays !== null && trialDays !== settings.trialDays) dto['trialDays'] = trialDays;
    const graceDays = Number(v.graceDays);
    if (v.graceDays !== null && graceDays !== settings.graceDays) dto['graceDays'] = graceDays;
    if (v.trialPlanCode && v.trialPlanCode !== settings.trialPlanCode) dto['trialPlanCode'] = v.trialPlanCode;
    if (v.fallbackPlanCode && v.fallbackPlanCode !== settings.fallbackPlanCode) dto['fallbackPlanCode'] = v.fallbackPlanCode;
    if (v.trialRequiresCard !== settings.trialRequiresCard) dto['trialRequiresCard'] = v.trialRequiresCard;
    const reminders = sortReminders(v.reminderDaysBefore);
    if (!sameList(reminders, sortReminders(settings.reminderDaysBefore))) dto['reminderDaysBefore'] = reminders;

    const bank: Partial<Record<BankKey, string | null>> = {};
    for (const key of BANK_KEYS) {
      const next = v.bankTransferInfo[key].trim() || null;
      if (next !== (settings.bankTransferInfo[key] ?? null)) bank[key] = next;
    }
    if (Object.keys(bank).length) dto['bankTransferInfo'] = bank;
    return dto as UpdatePlatformSettingsDto;
  }

  #reset(settings: PlatformSettingsDto) {
    this.$settings.set(settings);
    const bank = settings.bankTransferInfo ?? ({} as BankTransferInfoDto);
    this.form.reset({
      trialDays: settings.trialDays,
      trialPlanCode: settings.trialPlanCode,
      trialRequiresCard: settings.trialRequiresCard,
      graceDays: settings.graceDays,
      fallbackPlanCode: settings.fallbackPlanCode,
      reminderDaysBefore: sortReminders(settings.reminderDaysBefore ?? []),
      bankTransferInfo: {
        bank: bank.bank ?? '',
        accountType: bank.accountType ?? '',
        accountNumber: bank.accountNumber ?? '',
        holderName: bank.holderName ?? '',
        holderTaxId: bank.holderTaxId ?? '',
        email: bank.email ?? '',
      },
    });
    this.$reminderDraft.set('');
  }
}
