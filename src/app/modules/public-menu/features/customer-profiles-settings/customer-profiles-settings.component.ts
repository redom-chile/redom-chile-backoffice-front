import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService, isPlanError, PlanUpsellService, PublicPlansService } from 'src/app/core/services/entitlements';
import { readApiError } from 'src/app/core/utils/api-error';
import { LoyaltyService } from 'src/app/modules/loyalty/data-access';
import {
  CustomerProfilesSettingsDto,
  DEFAULT_CUSTOMER_PROFILES,
  getPublicMenuErrorMessage,
  MenuSettingsDto,
  MenuSettingsService,
} from 'src/app/modules/public-menu/data-access';
import { ButtonComponent, IconComponent, ToastService, ToggleComponent } from 'src/ui';

type Changes = Partial<CustomerProfilesSettingsDto>;
type TextField = 'consentText' | 'privacyUrl';
type CheckField = 'askPhone' | 'showUsual' | 'showLoyalty';

const CONSENT_MAX = 500;
const HTTPS_URL = /^https:\/\/[^\s/$.?#].[^\s]*$/i;

/** Respaldo: se usa solo si menu-settings no trae defaultConsentText (versión 1 del texto de Redom). */
export const REDOM_CONSENT_TEXT =
  'Acepto que Redom guarde mi correo, mi nombre, mi teléfono (si lo doy) y mis preferencias para reconocerme en las cartas de los locales que usan Redom. ' +
  'Cada local ve solo mis pedidos y mi fidelización con él, nunca mis preferencias de salud. ' +
  'Puedo borrar mi perfil cuando quiera desde la carta.';

const FIELD_MESSAGES: Record<string, string> = {
  consentText: `El texto puede tener hasta ${CONSENT_MAX} caracteres.`,
  privacyUrl: 'Usa una dirección https:// válida.',
  mode: 'Elige una forma de reconocer a tus clientes.',
  channel: 'Por ahora el código solo se envía por correo.',
};

const toText = (value: string | null | undefined) => (value ?? '').trim() || null;
const sameJson = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

/** Sección "Clientes reconocidos" de la tarjeta del local (plan customerProfiles). Etapa 10. */
@Component({
  selector: 'app-customer-profiles-settings',
  imports: [ButtonComponent, IconComponent, ToggleComponent],
  templateUrl: './customer-profiles-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerProfilesSettingsComponent {
  readonly #service = inject(MenuSettingsService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #plans = inject(PublicPlansService);
  readonly #upsell = inject(PlanUpsellService);
  readonly #loyalty = inject(LoyaltyService);

  readonly consentMax = CONSENT_MAX;

  readonly settings = input.required<MenuSettingsDto>();
  readonly changed = output<MenuSettingsDto[]>();

  readonly $id = computed(() => `menu-${this.settings().locationId}-profiles`);
  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('customerProfiles'));
  readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));
  readonly $editable = computed(() => this.$hasFeature() && this.$canEdit());
  readonly $planBadge = computed(() => {
    const name = this.#plans.planName(this.#plans.firstPlanWith(['customerProfiles'])?.code);
    return name ? `Plan ${name}` : 'No incluido';
  });
  /** Texto oficial de Redom (cuando el local no tiene uno propio). */
  readonly $redomConsent = computed(() => this.settings().defaultConsentText?.trim() || REDOM_CONSENT_TEXT);

  readonly #saved = computed(() => ({ ...DEFAULT_CUSTOMER_PROFILES, ...(this.settings().customerProfiles ?? {}) }), { equal: sameJson });
  readonly $value = linkedSignal(() => this.#saved());
  readonly $busy = signal<string | null>(null);

  // Textos: se reinician solo si cambia su valor guardado.
  readonly #savedConsent = computed(() => this.#saved().consentText ?? '');
  readonly #savedPrivacy = computed(() => this.#saved().privacyUrl ?? '');
  readonly $consentText = linkedSignal(() => this.#savedConsent());
  readonly $privacyUrl = linkedSignal(() => this.#savedPrivacy());
  readonly $serverErrors = signal<Partial<Record<TextField, string>>>({});

  readonly $errors = computed(() => {
    const errors: Partial<Record<TextField, string>> = { ...this.$serverErrors() };
    if (this.$consentText().trim().length > CONSENT_MAX) errors.consentText = `Máximo ${CONSENT_MAX} caracteres.`;
    const url = this.$privacyUrl().trim();
    if (url && !HTTPS_URL.test(url)) errors.privacyUrl = 'Debe empezar con https://';
    return errors;
  });
  readonly #textChanges = computed<Changes>(() => {
    const changes: Record<string, string | null> = {};
    const consent = toText(this.$consentText());
    const privacy = toText(this.$privacyUrl());
    if (consent !== toText(this.#savedConsent())) changes['consentText'] = consent;
    if (privacy !== toText(this.#savedPrivacy())) changes['privacyUrl'] = privacy;
    return changes as Changes;
  });
  readonly $hasTextChanges = computed(() => Object.keys(this.#textChanges()).length > 0);
  readonly $textsValid = computed(() => !this.$errors().consentText && !this.$errors().privacyUrl);

  // Códigos del mes (customerOtpMonth), si el plan los informa.
  readonly $otpUsage = computed(() => {
    const entitlements = this.#entitlements.$entitlements();
    if (!entitlements || !('customerOtpMonth' in (entitlements.usage ?? {}))) return null;
    const used = this.#entitlements.usageOf('customerOtpMonth');
    const limit = this.#entitlements.limitOf('customerOtpMonth');
    return { used, limit, reached: limit !== null && used >= limit };
  });

  // Fidelización: aviso si el plan no la incluye o el programa no está activo.
  readonly #hasLoyalty = computed(() => this.#entitlements.hasFeature('loyalty'));
  readonly #program = rxResource({
    params: () =>
      this.$hasFeature() && this.#hasLoyalty() && this.#access.can(PERMISSIONS.LOYALTY.SEE_MODULE) && this.$value().enabled ? true : undefined,
    stream: () => this.#loyalty.getProgram().pipe(catchError(() => of(undefined))),
  });
  readonly $loyaltyHint = computed(() => {
    if (!this.#hasLoyalty()) return 'Tu plan no incluye fidelización: el saldo no se mostrará.';
    const program = this.#program.value();
    if (program === null || program?.isActive === false) return 'Tu programa de fidelización no está activo: el saldo se mostrará cuando lo actives.';
    return null;
  });

  setEnabled(enabled: boolean) {
    this.#saveNow('enabled', { enabled }, enabled ? 'Clientes reconocidos activado' : 'Clientes reconocidos desactivado');
  }

  setMode(mode: CustomerProfilesSettingsDto['mode']) {
    if (mode === this.$value().mode) return;
    this.#saveNow('mode', { mode }, mode === 'verified' ? 'Ahora se pide un código por correo' : 'Ahora solo se recuerda en el dispositivo del cliente');
  }

  setCheck(field: CheckField, value: boolean) {
    this.#saveNow(field, { [field]: value }, 'Ajuste guardado');
  }

  onText(field: TextField, event: Event) {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    (field === 'consentText' ? this.$consentText : this.$privacyUrl).set(value);
    if (this.$serverErrors()[field]) this.$serverErrors.update(({ [field]: _, ...rest }) => rest);
  }

  /** Vacío = texto de Redom (se actualiza con sus versiones); "editar" parte de una copia. */
  setConsent(text: string) {
    this.$consentText.set(text);
    this.$serverErrors.update(({ consentText: _, ...rest }) => rest);
  }

  saveTexts() {
    if (!this.$hasTextChanges() || !this.$textsValid() || this.$busy()) return;
    this.#save('texts', this.#textChanges(), 'Textos guardados');
  }

  discardTexts() {
    this.$consentText.set(this.#savedConsent());
    this.$privacyUrl.set(this.#savedPrivacy());
    this.$serverErrors.set({});
  }

  upsell() {
    this.#upsell.open({ features: ['customerProfiles'] });
  }

  /** Switches, radios y casillas: se guardan al tiro, con rollback. */
  #saveNow(key: string, changes: Changes, message: string) {
    if (this.$busy()) return;
    const previous = this.$value();
    this.$value.set({ ...previous, ...changes });
    this.#save(key, changes, message, () => this.$value.set(previous));
  }

  #save(key: string, customerProfiles: Changes, message: string, rollback?: () => void) {
    this.$busy.set(key);
    this.#service.update(this.settings().locationId, { customerProfiles }).subscribe({
      next: (settings) => {
        this.$busy.set(null);
        this.#toast.show(message, 'success');
        this.changed.emit([settings]);
      },
      error: (error: unknown) => {
        this.$busy.set(null);
        rollback?.();
        // Activar sin el plan: 403 PLAN_FEATURE_NOT_INCLUDED abre el modal del plan (interceptor global)
        if (!isPlanError(error)) this.#toast.show(this.#errorMessage(error), 'error');
      },
    });
  }

  /** 400 MENU_SETTINGS_INVALID: marca el campo de details.field (customerProfiles.<campo>). */
  #errorMessage(error: unknown): string {
    const api = readApiError(error);
    if (api.code === 'MENU_SETTINGS_INVALID' && typeof api.details['field'] === 'string') {
      const field = api.details['field'].replace(/^customerProfiles\./, '');
      if (field === 'consentText' || field === 'privacyUrl') this.$serverErrors.update((errors) => ({ ...errors, [field]: FIELD_MESSAGES[field] }));
      if (FIELD_MESSAGES[field]) return FIELD_MESSAGES[field];
    }
    return getPublicMenuErrorMessage(error, 'No se pudo guardar la configuración de clientes reconocidos.');
  }
}
