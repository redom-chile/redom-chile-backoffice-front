import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, output, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService, roundCurrency } from 'src/app/core/services/business-settings';
import { EntitlementsService, PlanUpsellService } from 'src/app/core/services/entitlements';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ProductModalResult, UpdateProductModalComponent } from 'src/app/modules/products/pages/product-list/features';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { openPromotionFormModal } from 'src/app/modules/public-menu/features/marketing-promotions';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { ButtonComponent, EmptyStateComponent, IconComponent, ToastService } from 'src/ui';
import { AiInsightActionDto, AiInsightDto, getMenuAiErrorMessage, isRouteMissing, MenuAiService } from '../data-access';
import { formatClp, INSIGHT_KINDS, insightMetrics, MenuAiTab, weekdayName } from '../menu-ai-shared';
import { MenuAiStore } from '../menu-ai.store';
import { MenuAiCalloutComponent } from './menu-ai-callout.component';

const PROMOTION_NAME_MAX = 120;

/** Sugerencias de precio y promociones a partir de las ventas y el food cost. Nada se aplica solo. */
@Component({
  selector: 'app-menu-ai-insights',
  imports: [DatePipe, ButtonComponent, EmptyStateComponent, IconComponent, MenuAiCalloutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-ai-insights.component.html',
})
export class MenuAiInsightsComponent {
  readonly #service = inject(MenuAiService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #upsell = inject(PlanUpsellService);
  readonly #business = inject(BusinessSettingsService);
  readonly #locationsService = inject(GetAllBusinessLocationsService);
  readonly store = inject(MenuAiStore);

  readonly locationId = input<number | null>(null);
  readonly locationChange = output<number | null>();
  readonly goTo = output<MenuAiTab>();

  readonly kinds = INSIGHT_KINDS;
  readonly metricsOf = insightMetrics;

  readonly $locations = computed(() =>
    (this.#locationsService.$locations() ?? []).filter((location) => location.isActive !== false).map(({ id, name }) => ({ id, name })),
  );
  readonly $isLoadingLocations = computed(() => !!this.#locationsService.$isLoading() && !this.#locationsService.$locations());
  readonly $locationId = computed(() => {
    const id = this.locationId();
    return id && this.$locations().some((location) => location.id === id) ? id : null;
  });

  readonly insights = rxResource({
    params: () => (this.store.$hasFeature() && !this.store.$unavailable() ? { locationId: this.$locationId() } : undefined),
    stream: ({ params }) => this.#service.getInsights(params.locationId).pipe(toRemoteResult()),
  });
  readonly $items = linkedSignal(() => resultValue(this.insights.value()));
  readonly $error = computed(() => resultError(this.insights.value()));
  readonly $errorMessage = computed(() => getMenuAiErrorMessage(this.$error(), 'Inténtalo de nuevo en unos minutos.') ?? 'Tu plan no incluye esta función.');
  readonly $isLoading = computed(() => this.insights.isLoading() && !this.$items());

  readonly $refreshing = signal(false);
  readonly $nextAt = signal<string | null>(null);
  readonly $busyId = signal<number | null>(null);

  // Margen bajo y subir precio necesitan inventario con recetas (food cost).
  readonly $showCostHint = computed(() => {
    const items = this.$items();
    return !!items && !this.#business.$ingredientsEnabled() && !items.some((item) => item.kind === 'lowMargin' || item.kind === 'priceIncrease');
  });

  readonly $canEditProducts = computed(() => this.#access.can(PERMISSIONS.PRODUCTS.UPDATE_PRODUCT));
  readonly $canCreatePromotions = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));

  constructor() {
    effect(() => {
      if (isRouteMissing(this.$error())) untracked(() => this.store.markUnavailable());
    });
  }

  onLocationChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.$nextAt.set(null);
    this.locationChange.emit(value ? Number(value) : null);
  }

  refresh() {
    if (this.$refreshing() || this.store.$unavailable()) return;
    this.$refreshing.set(true);
    this.#service
      .refreshInsights(this.$locationId())
      .pipe(finalize(() => this.$refreshing.set(false)))
      .subscribe({
        next: (items) => {
          this.$items.set(items);
          this.$nextAt.set(null);
          this.store.refreshOverview();
          this.#toast.show(items.length ? 'Actualizamos las sugerencias' : 'Por ahora no hay sugerencias nuevas', 'success');
        },
        error: (error: unknown) => {
          const api = readApiError(error);
          if (api.code === 'AI_INSIGHTS_RATE_LIMITED') {
            const nextAt = typeof api.details['nextAt'] === 'string' ? api.details['nextAt'] : null;
            this.$nextAt.set(nextAt);
            if (nextAt) return;
          }
          this.store.handleError(error, 'No se pudieron actualizar las sugerencias.');
        },
      });
  }

  dismiss(insight: AiInsightDto) {
    if (this.$busyId()) return;
    this.$busyId.set(insight.id);
    this.#service
      .dismissInsight(insight.id)
      .pipe(finalize(() => this.$busyId.set(null)))
      .subscribe({
        next: () => {
          this.$items.update((items) => items?.filter((item) => item.id !== insight.id) ?? null);
          this.#toast.show('Ocultamos la sugerencia. No volverá a aparecer en 30 días.', 'success');
        },
        error: (error: unknown) => {
          // Ya no existía: se quita igual.
          if (readApiError(error).status === 404 && !isRouteMissing(error)) {
            this.$items.update((items) => items?.filter((item) => item.id !== insight.id) ?? null);
            return;
          }
          this.store.handleError(error, 'No se pudo ocultar la sugerencia.');
        },
      });
  }

  actionLabel(action: AiInsightActionDto): string {
    switch (action.type) {
      case 'editPrice':
        return `Cambiar precio a ${formatClp(action.suggestedPrice)}`;
      case 'createPromotion': {
        const day = weekdayName(action.weekday);
        return `Crear promoción ${action.suggestedPercent}%${day ? ` los ${day.toLowerCase()}` : ''}`;
      }
      case 'editProduct':
        return 'Editar producto';
    }
  }

  actionIcon(action: AiInsightActionDto): string {
    return action.type === 'createPromotion' ? 'sell' : action.type === 'editPrice' ? 'price_change' : 'edit';
  }

  canRun(action: AiInsightActionDto): boolean {
    return action.type === 'createPromotion' ? this.$canCreatePromotions() : this.$canEditProducts();
  }

  run(insight: AiInsightDto) {
    const action = insight.action;
    if (!action || this.$busyId()) return;
    if (action.type === 'createPromotion') this.#createPromotion(insight, action);
    else this.#editProduct(insight, action.productId, action.type === 'editPrice' ? action.suggestedPrice : null);
  }

  /**
   * Abre la edición del producto; con precio sugerido lo deja puesto si tiene una sola variedad activa.
   * suggestedPrice viene con IVA: si el negocio guarda precios sin IVA se le descuenta.
   */
  #editProduct(insight: AiInsightDto, productId: number, suggestedPrice: number | null) {
    this.$busyId.set(insight.id);
    this.#service
      .getProduct(productId)
      .pipe(finalize(() => this.$busyId.set(null)))
      .subscribe({
        next: (product) => {
          let data: ProductDto = product;
          if (suggestedPrice !== null) {
            const excludesVat = this.#business.$pricesExcludeVat();
            const price = excludesVat
              ? roundCurrency(suggestedPrice / (1 + this.#business.$vatRate() / 100), this.#business.$currencyPrecision())
              : suggestedPrice;
            const label = excludesVat ? `${formatClp(price)} sin IVA (${formatClp(suggestedPrice)} con IVA)` : formatClp(suggestedPrice);
            const active = product.variations.filter((variation) => variation.isActive !== false);
            if (active.length === 1) {
              data = {
                ...product,
                variations: product.variations.map((variation) => (variation.id === active[0].id ? { ...variation, sellPriceIncTax: price } : variation)),
              };
              this.#toast.show(`Pusimos el precio sugerido: ${label}. Revísalo y guarda.`, 'warning');
            } else {
              this.#toast.show(`Precio sugerido: ${label}. Ajústalo en la variedad que corresponda.`, 'warning');
            }
          }
          this.#dialog
            .open<UpdateProductModalComponent, ProductDto, ProductModalResult>(UpdateProductModalComponent, {
              width: '720px',
              maxWidth: '95vw',
              disableClose: true,
              data,
            })
            .afterClosed()
            .subscribe((result) => {
              if (result !== 'updated') return;
              this.#toast.show('Producto actualizado', 'success');
              this.store.refreshOverview();
            });
        },
        error: (error: unknown) => this.store.handleError(error, 'No se pudo abrir el producto.'),
      });
  }

  /** Abre la creación de la promoción ya rellenada (un producto por promoción). */
  #createPromotion(insight: AiInsightDto, action: Extract<AiInsightActionDto, { type: 'createPromotion' }>) {
    if (!this.#entitlements.hasFeature('menu_marketing')) {
      this.#upsell.open({ features: ['menu_marketing'] });
      return;
    }
    this.$busyId.set(insight.id);
    this.#service
      .getProduct(action.productId)
      .pipe(finalize(() => this.$busyId.set(null)))
      .subscribe({
        next: (product) => {
          const day = weekdayName(action.weekday);
          const name = `${day ? `${day}: ` : ''}${action.suggestedPercent}% en ${product.name}`.slice(0, PROMOTION_NAME_MAX);
          openPromotionFormModal(this.#dialog, {
            locations: this.$locations(),
            timeZone: this.#business.$settings()?.timeZone ?? null,
            locationId: this.$locationId(),
            draft: {
              name,
              target: { id: product.id, name: product.name },
              discountType: 'percent',
              value: action.suggestedPercent,
              daysOfWeek: day ? [action.weekday] : undefined,
            },
          }).subscribe();
        },
        error: (error: unknown) => this.store.handleError(error, 'No se pudo preparar la promoción.'),
      });
  }
}
