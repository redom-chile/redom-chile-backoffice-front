import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { catchError, EMPTY, expand, from, map, mergeMap, Observable, of, reduce, toArray } from 'rxjs';
import { BusinessSettingsService, InventorySettings, StockDeductionMoment, UpdateInventorySettingsDto } from 'src/app/core/services/business-settings';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { getInventoryErrorMessage, RecipesService } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  ButtonComponent,
  CardComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  IconComponent,
  SkeletonComponent,
  ToastService,
  ToggleComponent,
} from 'src/ui';

type InventorySettingKey = keyof InventorySettings;

const SUCCESS_MESSAGES: Partial<Record<InventorySettingKey, [on: string, off: string]>> = {
  inventoryEnabled: ['Inventario activado', 'Inventario desactivado'],
  ingredientsEnabled: ['Ingredientes y recetas activados', 'Ingredientes y recetas desactivados'],
  deductStockOnSale: ['Descuento de stock al vender activado', 'Descuento de stock al vender desactivado'],
  allowNegativeStock: ['Ahora se permite stock negativo', 'Ya no se permite stock negativo'],
};

export const STOCK_DEDUCTION_MOMENT_OPTIONS: ReadonlyArray<{ value: StockDeductionMoment; label: string; hint: string }> = [
  {
    value: 'on_order',
    label: 'Al ingresar el pedido',
    hint: 'Descuenta apenas el producto entra al pedido, también al agregar productos a un pedido abierto.',
  },
  { value: 'on_payment', label: 'Al pagar', hint: 'Descuenta cuando el pedido queda pagado por completo.' },
];

// Revisión de recetas: hasta 500 productos y 4 consultas de receta en paralelo.
const PRODUCTS_PER_PAGE = 100;
const MAX_PRODUCT_PAGES = 5;
const RECIPE_CONCURRENCY = 4;
const RECIPE_ISSUES_SHOWN = 5;

type ProductForRecipeCheck = Readonly<{ id: number; name: string; type: string | null; stockMode?: string }>;

export type RecipeIssue = Readonly<{ productId: number; name: string; status: 'empty' | 'incomplete' }>;
type RecipeCheckResult = Readonly<{ issues: RecipeIssue[]; failed: number }>;

/**
 * Pestaña "Inventario" de Mi negocio. Cada cambio se guarda al momento (igual que el estado y el color
 * del negocio): mientras guarda, los controles quedan deshabilitados y si falla se vuelve al valor anterior.
 */
@Component({
  selector: 'app-inventory-settings',
  imports: [RouterLink, CardComponent, ToggleComponent, IconComponent, ButtonComponent, SkeletonComponent],
  templateUrl: './inventory-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventorySettingsComponent {
  readonly #settingsService = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);
  readonly #dialog = inject(MatDialog);
  readonly #http = inject(HttpClient);
  readonly #recipes = inject(RecipesService);

  readonly deductionMoments = STOCK_DEDUCTION_MOMENT_OPTIONS;
  readonly $isLoaded = this.#settingsService.$isLoaded;
  readonly $isLoading = this.#settingsService.$isLoading;
  readonly $hasError = this.#settingsService.$hasError;

  // Valores aún no confirmados por el backend. Al limpiarlos, los controles vuelven al valor guardado.
  readonly #draft = signal<UpdateInventorySettingsDto>({});
  readonly $isSaving = signal(false);
  // El inventario se activó en esta visita: se sugieren los primeros pasos.
  readonly $justEnabled = signal(false);

  readonly $view = computed<InventorySettings>(() => ({ ...this.#settingsService.$inventory(), ...this.#draft() }));

  // Con ventas que descuentan y recetas activas, se buscan platos "por receta" sin ingredientes (no descontarían nada).
  readonly #shouldCheckRecipes = computed(() => {
    const saved = this.#settingsService.$inventory();
    return this.#settingsService.$isLoaded() && saved.inventoryEnabled && saved.deductStockOnSale && saved.ingredientsEnabled;
  });

  readonly recipeCheck = rxResource({
    params: () => (this.#shouldCheckRecipes() ? { check: true } : undefined),
    stream: () => this.#checkRecipes(),
  });

  readonly $recipeIssues = computed(() => this.recipeCheck.value()?.issues ?? []);
  readonly $recipeIssuesShown = computed(() => this.$recipeIssues().slice(0, RECIPE_ISSUES_SHOWN));
  readonly $recipeIssuesMore = computed(() => Math.max(0, this.$recipeIssues().length - RECIPE_ISSUES_SHOWN));
  // Si la revisión falla no se bloquea la página: solo una nota pequeña.
  readonly $recipeCheckNote = computed(() => {
    if (this.recipeCheck.error()) return 'No se pudieron revisar las recetas.';
    const failed = this.recipeCheck.value()?.failed ?? 0;
    if (!failed) return null;
    return failed === 1 ? 'No se pudo revisar la receta de 1 producto.' : `No se pudieron revisar las recetas de ${failed} productos.`;
  });

  readonly $momentHint = computed(
    () => this.deductionMoments.find((option) => option.value === this.$view().stockDeductionMoment)?.hint ?? '',
  );

  retry() {
    this.#settingsService.reload();
  }

  toggle(key: InventorySettingKey, value: boolean) {
    if (key === 'inventoryEnabled' && !value) {
      this.#confirmDisableInventory();
      return;
    }
    this.#save({ [key]: value }, key, value);
  }

  changeMoment(event: Event) {
    const value = (event.target as HTMLSelectElement).value as StockDeductionMoment;
    this.#save({ stockDeductionMoment: value }, 'stockDeductionMoment', value);
  }

  #checkRecipes(): Observable<RecipeCheckResult> {
    return this.#fetchProducts(1).pipe(
      expand(({ page, totalPages }) => (page < totalPages && page < MAX_PRODUCT_PAGES ? this.#fetchProducts(page + 1) : EMPTY)),
      reduce((all, { data }) => [...all, ...data], [] as ProductForRecipeCheck[]),
      map((products) =>
        products.filter((product) => product.stockMode === 'recipe' && product.type !== 'modifier' && product.type !== 'ingredient'),
      ),
      mergeMap((products) =>
        from(products).pipe(
          mergeMap(
            (product) =>
              this.#recipes.getByProduct(product.id).pipe(
                map((recipe): RecipeIssue | null | 'failed' => {
                  const variations = recipe.variations;
                  const emptyCount = variations.filter((variation) => variation.items.length === 0).length;
                  if (variations.length === 0 || emptyCount === variations.length) {
                    return { productId: product.id, name: product.name, status: 'empty' };
                  }
                  return emptyCount > 0 ? { productId: product.id, name: product.name, status: 'incomplete' } : null;
                }),
                catchError(() => of('failed' as const)),
              ),
            RECIPE_CONCURRENCY,
          ),
          toArray(),
        ),
      ),
      map((results) => ({
        issues: results
          .filter((result): result is RecipeIssue => result !== null && result !== 'failed')
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        failed: results.filter((result) => result === 'failed').length,
      })),
    );
  }

  #fetchProducts(page: number): Observable<{ page: number; totalPages: number; data: ProductForRecipeCheck[] }> {
    const params = new HttpParams().set('page', page).set('perPage', PRODUCTS_PER_PAGE);
    return this.#http
      .get<StandardizedPagination<ProductForRecipeCheck>>(`${ApiPathEnum.RESTAURANT}/products`, { params })
      .pipe(map((response) => ({ page, totalPages: response.pagination?.totalPages ?? 1, data: response.data ?? [] })));
  }

  // Apagar el inventario con "descontar" o "ingredientes" activos da 400: se apagan en el mismo PATCH.
  #confirmDisableInventory() {
    const current = this.$view();
    const changes: UpdateInventorySettingsDto = {
      inventoryEnabled: false,
      ...(current.deductStockOnSale ? { deductStockOnSale: false } : {}),
      ...(current.ingredientsEnabled ? { ingredientsEnabled: false } : {}),
    };
    // El switch ya se ve apagado: se refleja en el borrador mientras se confirma.
    this.#draft.set(changes);
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Desactivar inventario',
          message:
            'Se ocultará el menú Inventario y se apagarán "Descontar stock al vender" e "Ingredientes y recetas". El stock y los movimientos registrados no se borran.',
          confirmText: 'Desactivar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          this.#draft.set({});
          return;
        }
        this.#save(changes, 'inventoryEnabled', false);
      });
  }

  #save(changes: UpdateInventorySettingsDto, key: InventorySettingKey, value: boolean | string) {
    const wasEnabled = this.#settingsService.$inventory().inventoryEnabled;
    this.#draft.set(changes);
    this.$isSaving.set(true);
    this.#settingsService.updateInventory(changes).subscribe({
      next: () => {
        this.#draft.set({});
        this.$isSaving.set(false);
        if (key === 'inventoryEnabled') this.$justEnabled.set(value === true && !wasEnabled);
        const messages = SUCCESS_MESSAGES[key];
        this.#toast.show(messages ? messages[value ? 0 : 1] : 'Configuración guardada', 'success');
      },
      error: (error) => {
        this.#draft.set({});
        this.$isSaving.set(false);
        this.#toast.show(getInventoryErrorMessage(error, 'No se pudo guardar la configuración.'), 'error');
      },
    });
  }
}
