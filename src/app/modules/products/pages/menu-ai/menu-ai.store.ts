import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { isFeatureNotIncluded, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { ToastService } from 'src/ui';
import {
  AiOverviewDto,
  AiQuotaDto,
  AiSettingsDto,
  AiSettingsField,
  disabledSettingOf,
  getMenuAiErrorMessage,
  isRouteMissing,
  MenuAiService,
  quotaFromError,
  TagRefDto,
  TagSuggestionDto,
} from './data-access';
import { DESCRIPTION_MAX } from './menu-ai-shared';

export type DescriptionDraft = Readonly<{
  productId: number;
  productName: string;
  current: string | null;
  options: readonly string[];
  /** Opción elegida; null si se escribió a mano. */
  choice: number | null;
  text: string;
  skipped: boolean;
}>;

export type TagChoice = TagSuggestionDto & Readonly<{ checked: boolean }>;
/** current: sus etiquetas de hoy (todas); los cambios se aplican sobre ellas. */
export type TagDraft = Readonly<{ productId: number; productName: string; current: readonly TagRefDto[]; add: readonly TagChoice[]; remove: readonly TagChoice[] }>;

/** Estado compartido de "Mejorar mi carta" (vive mientras la página está abierta, así no se pierde al cambiar de pestaña). */
@Injectable()
export class MenuAiStore {
  readonly #service = inject(MenuAiService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #access = inject(AccessService);
  readonly #toast = inject(ToastService);

  // Sin la función en el plan no se llama a la API.
  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('menuAiContent'));
  readonly $canUpdateProducts = computed(() => this.#access.can(PERMISSIONS.PRODUCTS.UPDATE_PRODUCT));
  // Ver la configuración pide public-menu:see-module; cambiarla, public-menu:manage-settings.
  readonly $canViewSettings = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.SEE_MODULE));
  readonly $canManageSettings = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));

  readonly settingsResource = rxResource({
    params: () => (this.$hasFeature() && this.$canViewSettings() ? true : undefined),
    stream: () => this.#service.getSettings().pipe(toRemoteResult()),
  });
  readonly $settings = linkedSignal<AiSettingsDto | null>(() => resultValue(this.settingsResource.value()));
  readonly $settingsError = computed(() => resultError(this.settingsResource.value()));
  readonly $settingsLoading = computed(() => this.settingsResource.isLoading() && !this.$settings());

  readonly #routeMissing = signal(false);
  /** El servidor no tiene las rutas (405 o "Cannot …"): acciones deshabilitadas. */
  readonly $unavailable = computed(() => this.#routeMissing() || isRouteMissing(this.$settingsError()));
  readonly $blocked = computed(() => isFeatureNotIncluded(this.$settingsError()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.$settingsError()));

  // null = no se sabe (sin permiso para ver la configuración o aún cargando): se deja pedir y el servidor responde.
  readonly $isEnabled = linkedSignal<boolean | null>(() => this.$settings()?.isEnabled ?? null);
  readonly $insightsEnabled = linkedSignal<boolean | null>(() => this.$settings()?.insightsEnabled ?? null);
  /** Ajuste a enfocar al abrir Configuración. */
  readonly $focusSetting = signal<AiSettingsField | null>(null);
  readonly $descriptionMax = computed(() => DESCRIPTION_MAX[this.$settings()?.length ?? 'short']);
  readonly $quota = linkedSignal<AiQuotaDto | null>(() => this.$settings()?.quota ?? null);

  // Se sube al aplicar cambios para que el resumen vuelva a contar.
  readonly $overviewVersion = signal(0);

  // Sugerencias pendientes de revisar.
  readonly $descriptions = signal<readonly DescriptionDraft[]>([]);
  /** Con "Completar las que faltan": productos sin descripción que quedan (null = no aplica). */
  readonly $remaining = signal<number | null>(null);
  /** Omitidos en la sesión: no se vuelven a pedir con "las que faltan" (excludeIds). */
  readonly $skippedIds = signal<ReadonlySet<number>>(new Set());
  readonly $tags = signal<readonly TagDraft[]>([]);
  readonly $tagsReviewed = signal(false);

  readonly $hasPendingWork = computed(() => this.$descriptions().some((item) => !item.skipped) || this.$tags().length > 0);

  setSettings(settings: AiSettingsDto) {
    this.$settings.set(settings);
  }

  refreshOverview() {
    this.$overviewVersion.update((version) => version + 1);
  }

  markUnavailable() {
    this.#routeMissing.set(true);
  }

  /** Sin permiso para ver la configuración, el estado sale del resumen. */
  syncFromOverview(overview: AiOverviewDto) {
    this.$quota.set(overview.quota);
    if (this.$settings()) return;
    this.$isEnabled.set(overview.settings.isEnabled);
    this.$insightsEnabled.set(overview.settings.insightsEnabled);
  }

  /** Muestra el error (o marca las rutas como inexistentes) y ajusta la cuota o el estado de la IA si corresponde. */
  handleError(error: unknown, fallback: string) {
    if (isRouteMissing(error)) {
      this.markUnavailable();
      return;
    }
    const quota = quotaFromError(error);
    if (quota?.period === 'month') this.$quota.set({ used: quota.used, limit: quota.limit });
    const setting = disabledSettingOf(error);
    if (setting === 'insightsEnabled') this.$insightsEnabled.set(false);
    else if (setting) this.$isEnabled.set(false);
    const message = getMenuAiErrorMessage(error, fallback);
    if (message) this.#toast.show(message, 'error');
  }
}
