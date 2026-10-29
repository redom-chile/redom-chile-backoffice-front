import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, linkedSignal, signal, untracked } from '@angular/core';
import { finalize } from 'rxjs';
import { ButtonComponent, EmptyStateComponent, ToastService, ToggleComponent } from 'src/ui';
import {
  AiInsightsFrequency,
  AiLength,
  AiSettingsField,
  AiTone,
  invalidSettingOf,
  MenuAiService,
  SETTING_ERRORS,
  UpdateAiSettingsDto,
} from '../data-access';
import { LENGTHS, TONES } from '../menu-ai-shared';
import { MenuAiStore } from '../menu-ai.store';
import { MenuAiQuotaComponent } from './menu-ai-quota.component';

const FREQUENCIES: ReadonlyArray<{ id: AiInsightsFrequency; label: string }> = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensual' },
];

/** Configuración de la IA del negocio: todo parte apagado y el plan marca el máximo. */
@Component({
  selector: 'app-menu-ai-settings',
  imports: [ButtonComponent, EmptyStateComponent, ToggleComponent, MenuAiQuotaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-ai-settings.component.html',
})
export class MenuAiSettingsComponent {
  readonly #service = inject(MenuAiService);
  readonly #toast = inject(ToastService);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly store = inject(MenuAiStore);

  readonly tones = TONES;
  readonly lengths = LENGTHS;
  readonly frequencies = FREQUENCIES;

  readonly $settings = this.store.$settings;
  readonly $canEdit = computed(() => this.store.$canManageSettings() && !this.store.$unavailable());

  readonly $isEnabled = linkedSignal(() => this.$settings()?.isEnabled ?? false);
  readonly $tone = linkedSignal<AiTone>(() => this.$settings()?.tone ?? 'friendly');
  readonly $length = linkedSignal<AiLength>(() => this.$settings()?.length ?? 'short');
  readonly $limitText = linkedSignal(() => {
    const limit = this.$settings()?.monthlyLimit;
    return limit === null || limit === undefined ? '' : String(limit);
  });
  readonly $insightsEnabled = linkedSignal(() => this.$settings()?.insightsEnabled ?? false);
  readonly $frequency = linkedSignal<AiInsightsFrequency>(() => this.$settings()?.insightsFrequency ?? 'weekly');
  readonly $saving = signal(false);
  /** Campo rechazado por el servidor (AI_SETTINGS_INVALID). */
  readonly $invalidField = signal<AiSettingsField | null>(null);
  readonly $serverError = computed(() => {
    const field = this.$invalidField();
    return field ? SETTING_ERRORS[field] : null;
  });

  readonly $planLimit = computed(() => this.$settings()?.quota.planLimit ?? null);
  readonly $toneExample = computed(() => TONES.find((tone) => tone.id === this.$tone())?.example ?? '');

  readonly $limit = computed<number | null>(() => {
    const text = this.$limitText().trim();
    return text ? Number(text) : null;
  });
  readonly $limitError = computed(() => {
    const limit = this.$limit();
    if (limit === null) return null;
    if (!Number.isInteger(limit) || limit < 0) return 'Usa un número entero desde 0.';
    const plan = this.$planLimit();
    if (plan !== null && limit > plan) return `No puede superar el de tu plan (${plan}).`;
    return null;
  });

  /** Solo las claves que cambiaron. */
  readonly $changes = computed<UpdateAiSettingsDto>(() => {
    const settings = this.$settings();
    if (!settings) return {};
    const changes: Record<string, unknown> = {};
    if (this.$isEnabled() !== settings.isEnabled) changes['isEnabled'] = this.$isEnabled();
    if (this.$tone() !== settings.tone) changes['tone'] = this.$tone();
    if (this.$length() !== settings.length) changes['length'] = this.$length();
    if (this.$limit() !== settings.monthlyLimit) changes['monthlyLimit'] = this.$limit();
    if (this.$insightsEnabled() !== settings.insightsEnabled) changes['insightsEnabled'] = this.$insightsEnabled();
    if (this.$frequency() !== settings.insightsFrequency) changes['insightsFrequency'] = this.$frequency();
    return changes as UpdateAiSettingsDto;
  });
  readonly $dirty = computed(() => Object.keys(this.$changes()).length > 0);

  constructor() {
    // Al llegar desde un aviso ("Ir a Configuración") se enfoca el ajuste que hay que activar.
    afterRenderEffect(() => {
      const field = this.store.$focusSetting();
      if (!field || !this.$settings()) return;
      const target = this.#host.nativeElement.querySelector<HTMLElement>(`#menu-ai-setting-${field}`);
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.focus({ preventScroll: true });
      untracked(() => this.store.$focusSetting.set(null));
    });
  }

  /** Marca el campo rechazado hasta que se cambie. */
  isInvalid(field: AiSettingsField): boolean {
    return this.$invalidField() === field;
  }

  set<T>(field: AiSettingsField, target: { set: (value: T) => void }, value: T) {
    target.set(value);
    if (this.$invalidField() === field) this.$invalidField.set(null);
  }

  onLimit(event: Event) {
    this.set('monthlyLimit', this.$limitText, (event.target as HTMLInputElement).value);
  }

  discard() {
    const settings = this.$settings();
    if (settings) this.$settings.set({ ...settings });
    this.$invalidField.set(null);
  }

  save() {
    if (this.$saving() || !this.$dirty() || !this.$canEdit()) return;
    if (this.$limitError()) {
      this.#toast.show('Revisa el límite mensual', 'warning');
      return;
    }
    this.$saving.set(true);
    this.#service
      .updateSettings(this.$changes())
      .pipe(finalize(() => this.$saving.set(false)))
      .subscribe({
        next: (settings) => {
          this.$invalidField.set(null);
          this.store.setSettings(settings);
          this.store.refreshOverview();
          this.#toast.show('Guardamos la configuración', 'success');
        },
        error: (error: unknown) => {
          const field = invalidSettingOf(error);
          if (field) {
            this.$invalidField.set(field);
            this.store.$focusSetting.set(field);
          }
          this.store.handleError(error, 'No se pudo guardar la configuración.');
        },
      });
  }
}
