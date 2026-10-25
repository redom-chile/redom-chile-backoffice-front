import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { PlanUpsellService } from 'src/app/core/services/entitlements';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { getPublicMenuErrorMessage, MenuDynamicService, MenuDynamicSettingsDto, MenuDynamicSettingsViewDto } from 'src/app/modules/public-menu/data-access';
import { isFeatureNotIncluded } from 'src/app/modules/public-menu/features/marketing-shared';
import {
  dynamicInvalidField,
  dynamicSaveError,
  isDynamicStageMissing,
  MenuDynamicCatalog,
  MenuDynamicItemsSelectComponent,
} from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { ButtonComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { MAX_SUGGESTED } from './suggestion-rule-form-modal.component';

type Mode = MenuDynamicSettingsDto['suggestions']['mode'];
type Draft = Readonly<{ mode: Mode; excludeProductIds: number[]; maxItems: number }>;

const MODES: ReadonlyArray<{ value: Mode; label: string; hint: string; plus: boolean }> = [
  { value: 'manual', label: 'Manual', hint: 'Solo tus reglas.', plus: false },
  { value: 'automatic', label: 'Automáticas', hint: 'Lo que más se pide junto en tu local (últimos 90 días).', plus: true },
  { value: 'both', label: 'Ambas', hint: 'Primero tus reglas y luego las automáticas.', plus: true },
];

const DEFAULT_DRAFT: Draft = { mode: 'manual', excludeProductIds: [], maxItems: 3 };

/** Cómo se arman las sugerencias del carrito (requiere menuDynamicPlus; sin él se muestra bloqueado). */
@Component({
  selector: 'app-suggestion-settings-card',
  imports: [ButtonComponent, IconComponent, SkeletonComponent, MenuDynamicItemsSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suggestion-settings-card.component.html',
})
export class SuggestionSettingsCardComponent {
  readonly #service = inject(MenuDynamicService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #upsell = inject(PlanUpsellService);

  readonly locationId = input.required<number>();
  readonly hasPlus = input(false);
  readonly catalog = input<MenuDynamicCatalog | null>(null);
  readonly catalogLoading = input(false);
  /** El servidor no tiene la etapa (lo sabe la lista de reglas). */
  readonly stageMissing = input(false);

  readonly modes = MODES;
  readonly maxOptions = Array.from({ length: MAX_SUGGESTED }, (_, index) => index + 1);
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));

  readonly settings = rxResource({
    params: () => (this.hasPlus() ? this.locationId() : undefined),
    stream: ({ params }) => this.#service.getDynamicSettings(params).pipe(toRemoteResult()),
  });
  readonly #error = computed(() => resultError(this.settings.value()));
  readonly $missing = computed(() => this.stageMissing() || isDynamicStageMissing(this.#error()));
  readonly $blocked = computed(() => !this.hasPlus() || isFeatureNotIncluded(this.#error()));
  readonly $errorMessage = computed(() => {
    const error = this.#error();
    if (!error || isDynamicStageMissing(error) || isFeatureNotIncluded(error)) return null;
    return getPublicMenuErrorMessage(error, 'No se pudo cargar la configuración de sugerencias.');
  });
  readonly $saved = linkedSignal<MenuDynamicSettingsViewDto | null>(() => resultValue(this.settings.value()));
  readonly $draft = linkedSignal<Draft>(() => {
    const saved = this.$saved()?.suggestions;
    return saved ? { mode: saved.mode, excludeProductIds: [...saved.excludeProductIds], maxItems: saved.maxItems } : DEFAULT_DRAFT;
  });
  readonly $dirty = computed(() => {
    const saved = this.$saved()?.suggestions ?? DEFAULT_DRAFT;
    const draft = this.$draft();
    return saved.mode !== draft.mode || saved.maxItems !== draft.maxItems || saved.excludeProductIds.join() !== draft.excludeProductIds.join();
  });
  readonly $locked = computed(() => !this.$canManage() || this.$blocked() || this.$missing() || !this.$saved());
  readonly $isSaving = signal(false);
  /** Ruta completa de details.field ("suggestions.maxItems"). */
  readonly $fieldError = signal<string | null>(null);
  /** Cuándo se calcularon las sugerencias automáticas (solo si el modo las usa). */
  readonly $pairsInfo = computed(() => {
    const saved = this.$saved();
    if (!saved || this.$draft().mode === 'manual') return null;
    if (!saved.suggestionPairsAt) return 'Las sugerencias automáticas aún no se calculan: usan las ventas de los últimos 90 días del local.';
    const date = new Date(saved.suggestionPairsAt);
    if (Number.isNaN(date.getTime())) return null;
    const label = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date);
    return `Sugerencias automáticas actualizadas el ${label}; usan las ventas de los últimos 90 días.`;
  });

  pickMode(event: Event, mode: Mode, plus: boolean) {
    if (plus && this.$blocked()) {
      event.preventDefault();
      this.unlock();
      return;
    }
    this.$draft.update((draft) => ({ ...draft, mode }));
    this.$fieldError.set(null);
  }

  setExclude(ids: number[]) {
    this.$draft.update((draft) => ({ ...draft, excludeProductIds: ids }));
    this.$fieldError.set(null);
  }

  setMax(raw: string) {
    this.$draft.update((draft) => ({ ...draft, maxItems: Number(raw) }));
    this.$fieldError.set(null);
  }

  unlock() {
    this.#upsell.open({ features: ['menuDynamicPlus'] });
  }

  discard() {
    const saved = this.$saved()?.suggestions ?? DEFAULT_DRAFT;
    this.$draft.set({ mode: saved.mode, excludeProductIds: [...saved.excludeProductIds], maxItems: saved.maxItems });
    this.$fieldError.set(null);
  }

  save() {
    const locationId = this.locationId();
    if (this.$locked() || this.$isSaving() || !this.$dirty()) return;
    this.$isSaving.set(true);
    this.$fieldError.set(null);
    const draft = this.$draft();
    this.#service.updateDynamicSettings(locationId, { suggestions: { ...draft } }).subscribe({
      next: (saved) => {
        this.$isSaving.set(false);
        if (locationId === this.locationId()) this.$saved.set(saved);
        this.#toast.show('Sugerencias guardadas', 'success');
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const field = dynamicInvalidField(error);
        if (field) this.$fieldError.set(field);
        const message = dynamicSaveError(error, 'No se pudo guardar la configuración.', this.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }
}
