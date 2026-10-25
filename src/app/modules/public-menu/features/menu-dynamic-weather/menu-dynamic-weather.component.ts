import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { getPublicMenuErrorMessage, MenuDynamicService, MenuDynamicSettingsDto, MenuDynamicSettingsViewDto, MenuWeatherCondition } from 'src/app/modules/public-menu/data-access';
import { isFeatureNotIncluded, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import {
  dynamicInvalidField,
  dynamicSaveError,
  isDynamicStageMissing,
  MenuDynamicCatalog,
  MenuDynamicItemsSelectComponent,
  MenuDynamicStageBannerComponent,
} from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { readApiError } from 'src/app/core/utils/api-error';
import { ButtonComponent, IconComponent, SkeletonComponent, ToastService, ToggleComponent } from 'src/ui';

type RuleKey = 'rain' | 'hot' | 'cold';

type RuleDraft = Readonly<{ on: boolean; title: string; temp: number | null; productIds: number[]; categoryIds: number[] }>;
type WeatherDraft = Readonly<{ enabled: boolean; rules: Readonly<Record<RuleKey, RuleDraft>> }>;

const TITLE_MAX = 60;

const CONDITION_LABELS: Record<MenuWeatherCondition, string> = { rain: 'lluvia', hot: 'calor', cold: 'frío' };

const RULES: ReadonlyArray<{ key: RuleKey; icon: string; label: string; tempLabel: string | null; defaultTitle: string; defaultTemp: number | null; hint: string }> = [
  { key: 'rain', icon: 'rainy', label: 'Lluvia', tempLabel: null, defaultTitle: 'Para la lluvia', defaultTemp: null, hint: 'Cuando está lloviendo en el local. Ej.: sopas, cazuelas, chocolate caliente.' },
  { key: 'hot', icon: 'sunny', label: 'Calor', tempLabel: 'Desde', defaultTitle: 'Para el calor', defaultTemp: 26, hint: 'Ej.: helados, jugos naturales, cervezas.' },
  { key: 'cold', icon: 'ac_unit', label: 'Frío', tempLabel: 'Hasta', defaultTitle: 'Para el frío', defaultTemp: 10, hint: 'Ej.: cafés, sopaipillas, platos calientes.' },
];

function draftFrom(dto: MenuDynamicSettingsDto | null): WeatherDraft {
  const weather = dto?.weather;
  const rule = (key: RuleKey): RuleDraft => {
    const info = RULES.find((item) => item.key === key)!;
    const saved = weather?.[key] ?? null;
    const temps = saved as { minTempC?: number; maxTempC?: number } | null;
    const temp = temps?.minTempC ?? temps?.maxTempC ?? info.defaultTemp;
    return {
      on: !!saved,
      title: saved?.title ?? info.defaultTitle,
      temp,
      productIds: [...(saved?.productIds ?? [])],
      categoryIds: [...(saved?.categoryIds ?? [])],
    };
  };
  return { enabled: !!weather?.enabled, rules: { rain: rule('rain'), hot: rule('hot'), cold: rule('cold') } };
}

/** Pestaña Clima: destacar productos según el clima actual del local (lluvia, calor o frío). */
@Component({
  selector: 'app-menu-dynamic-weather',
  imports: [RouterLink, ButtonComponent, IconComponent, SkeletonComponent, ToggleComponent, MarketingUpsellCardComponent, MenuDynamicItemsSelectComponent, MenuDynamicStageBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-dynamic-weather.component.html',
})
export class MenuDynamicWeatherComponent {
  readonly #service = inject(MenuDynamicService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly locationId = input.required<number>();
  /** El local tiene latitud y longitud en Carta pública (respaldo si la respuesta no trae hasLocation). */
  readonly hasCoordinates = input(false);
  readonly catalog = input<MenuDynamicCatalog | null>(null);
  readonly catalogLoading = input(false);

  readonly rules = RULES;
  readonly titleMax = TITLE_MAX;
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));

  readonly settings = rxResource({
    params: () => this.locationId(),
    stream: ({ params }) => this.#service.getDynamicSettings(params).pipe(toRemoteResult()),
  });
  readonly #error = computed(() => resultError(this.settings.value()));
  readonly $missing = computed(() => isDynamicStageMissing(this.#error()));
  readonly $blocked = computed(() => isFeatureNotIncluded(this.#error()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.#error()));
  readonly $errorMessage = computed(() => {
    const error = this.#error();
    if (!error || this.$missing() || this.$blocked()) return null;
    return getPublicMenuErrorMessage(error, 'No se pudo cargar la configuración del clima.');
  });
  readonly $saved = linkedSignal<MenuDynamicSettingsViewDto | null>(() => resultValue(this.settings.value()));
  readonly $draft = linkedSignal<WeatherDraft>(() => draftFrom(this.$saved()));
  readonly $dirty = computed(() => JSON.stringify(this.$draft()) !== JSON.stringify(draftFrom(this.$saved())));
  /** El backend respondió MENU_WEATHER_NO_LOCATION aunque el local pareciera tener coordenadas. */
  readonly $serverNoLocation = signal(false);
  readonly $noLocation = computed(() => {
    if (this.$serverNoLocation()) return true;
    const hasLocation = this.$saved()?.hasLocation;
    return typeof hasLocation === 'boolean' ? !hasLocation : !this.hasCoordinates();
  });
  /** "Ahora: 12 °C, lluvia · se destaca «Para la lluvia»" (solo con el clima encendido y guardado). */
  readonly $currentWeather = computed(() => {
    const saved = this.$saved();
    const now = saved?.weather.enabled ? saved.currentWeather : null;
    if (!now) return null;
    const temp = `${Math.round(now.temperatureC)} °C`;
    const condition = now.condition;
    if (!condition) return `Ahora: ${temp}${now.precipitationMm > 0 ? ', lluvia' : ''} · ninguna regla aplica en este momento.`;
    const rule = saved?.weather[condition];
    return `Ahora: ${temp}, ${CONDITION_LABELS[condition]}${rule ? ` · se destaca «${rule.title}»` : ''}.`;
  });
  readonly $locked = computed(() => !this.$canManage() || this.$missing() || !this.$saved());
  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  /** Campo rechazado por el backend: "rain.title", "hot.minTempC"… */
  readonly $serverField = signal<string | null>(null);
  readonly $problems = computed(() => this.#problems());

  hasUnsavedChanges(): boolean {
    return this.$dirty();
  }

  problem(key: RuleKey, field: 'title' | 'temp' | 'items'): string | null {
    const message = this.$problems()[`${key}.${field}`] ?? null;
    return message && (this.$submitted() || field !== 'items') ? message : null;
  }

  setEnabled(enabled: boolean) {
    this.$draft.update((draft) => ({ ...draft, enabled }));
  }

  updateRule(key: RuleKey, patch: Partial<RuleDraft>) {
    this.$draft.update((draft) => ({ ...draft, rules: { ...draft.rules, [key]: { ...draft.rules[key], ...patch } } }));
    if (this.$serverField()?.startsWith(key)) this.$serverField.set(null);
  }

  setTemp(key: RuleKey, raw: string) {
    this.updateRule(key, { temp: raw.trim() === '' ? null : Number(raw) });
  }

  discard() {
    this.$draft.set(draftFrom(this.$saved()));
    this.$submitted.set(false);
    this.$serverField.set(null);
  }

  save() {
    const locationId = this.locationId();
    if (this.$locked() || this.$isSaving() || !this.$dirty()) return;
    this.$submitted.set(true);
    const problems = this.$problems();
    if (Object.keys(problems).length) {
      this.#toast.show(problems['general'] ?? 'Revisa los campos marcados', 'warning');
      return;
    }
    this.$isSaving.set(true);
    this.$serverField.set(null);
    this.#service.updateDynamicSettings(locationId, { weather: this.#dto() } as Partial<MenuDynamicSettingsDto>).subscribe({
      next: (saved) => {
        this.$isSaving.set(false);
        this.$submitted.set(false);
        this.$serverNoLocation.set(false);
        if (locationId === this.locationId()) this.$saved.set(saved);
        this.#toast.show('Reglas del clima guardadas', 'success');
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        if (readApiError(error).code === 'MENU_WEATHER_NO_LOCATION') this.$serverNoLocation.set(true);
        const field = dynamicInvalidField(error);
        if (field) this.$serverField.set(field.replace(/^weather\./, ''));
        const message = dynamicSaveError(error, 'No se pudo guardar el clima.', this.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  #problems(): Record<string, string> {
    const problems: Record<string, string> = {};
    const draft = this.$draft();
    const active = RULES.filter((rule) => draft.rules[rule.key].on);
    if (draft.enabled && !active.length) problems['general'] = 'Activa al menos una regla (lluvia, calor o frío).';
    if (draft.enabled && this.$noLocation()) problems['general'] = 'Agrega la ubicación del local en Carta pública para usar el clima.';
    for (const rule of active) {
      const value = draft.rules[rule.key];
      const title = value.title.trim();
      if (!title) problems[`${rule.key}.title`] = 'Escribe el título.';
      else if (title.length > TITLE_MAX) problems[`${rule.key}.title`] = `Hasta ${TITLE_MAX} caracteres.`;
      if (rule.tempLabel && (value.temp === null || !Number.isFinite(value.temp) || value.temp < -30 || value.temp > 50))
        problems[`${rule.key}.temp`] = 'Una temperatura entre -30 y 50 °C.';
      if (!value.productIds.length && !value.categoryIds.length) problems[`${rule.key}.items`] = 'Elige al menos un producto o una categoría.';
    }
    const hot = draft.rules.hot;
    const cold = draft.rules.cold;
    if (hot.on && cold.on && hot.temp !== null && cold.temp !== null && cold.temp >= hot.temp && !problems['cold.temp'])
      problems['cold.temp'] = 'Debe ser menor que la temperatura de calor.';
    const server = this.$serverField();
    if (server) {
      const [key, field] = server.split('.');
      const mapped = field === 'minTempC' || field === 'maxTempC' ? 'temp' : field === 'productIds' || field === 'categoryIds' ? 'items' : field;
      const id = `${key}.${mapped}`;
      if (!problems[id]) problems[id] = 'El servidor rechazó este valor. Revísalo.';
    }
    return problems;
  }

  /** Cada regla enviada reemplaza la anterior; null la borra. */
  #dto(): MenuDynamicSettingsDto['weather'] {
    const draft = this.$draft();
    const base = (key: RuleKey) => {
      const value = draft.rules[key];
      return { title: value.title.trim(), productIds: value.productIds, categoryIds: value.categoryIds };
    };
    return {
      enabled: draft.enabled,
      rain: draft.rules.rain.on ? base('rain') : null,
      hot: draft.rules.hot.on ? { ...base('hot'), minTempC: draft.rules.hot.temp! } : null,
      cold: draft.rules.cold.on ? { ...base('cold'), maxTempC: draft.rules.cold.temp! } : null,
    };
  }
}
