import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import {
  getPublicMenuErrorMessage,
  MenuSettingsService,
  ProductAvailabilityDto,
  UpdateProductAvailabilityDto,
} from 'src/app/modules/public-menu/data-access';
import {
  formatSoldOutUntil,
  SoldOutChoice,
  SoldOutMenuComponent,
  soldOutUntilFor,
} from 'src/app/modules/public-menu/features/sold-out-menu';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ApiPathEnum } from 'src/environments';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';

// Máximo por página del backend.
const SEARCH_PAGE_SIZE = 100;

/** Configuración → Agotados de hoy (también desde el POS): agotar u ocultar productos en un local. */
@Component({
  selector: 'app-sold-out',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, CheckPermissionDirective, SoldOutMenuComponent],
  templateUrl: './sold-out.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoldOutComponent {
  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #service = inject(MenuSettingsService);
  readonly #toast = inject(ToastService);
  readonly #locationsService = inject(GetAllBusinessLocationsService);
  readonly #branchId = inject(WhoamiService).$branchId;
  readonly #business = inject(BusinessSettingsService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly $locations = computed(() => (this.#locationsService.$locations() ?? []).filter((location) => location.isActive !== false));
  readonly $isLoadingLocations = computed(() => !!this.#locationsService.$isLoading() && !this.#locationsService.$locations());
  readonly #timeZone = computed(() => this.#business.$settings()?.timeZone ?? null);

  readonly #queryLocationId = toSignal(
    this.#route.queryParamMap.pipe(map((params) => Number(params.get('locationId')) || null)),
    { initialValue: null },
  );
  // El de la URL; si no, la sucursal del usuario; si no, el primero.
  readonly $locationId = computed(() => {
    const locations = this.$locations();
    if (!locations.length) return null;
    const ids = new Set(locations.map((location) => location.id));
    const query = this.#queryLocationId();
    if (query && ids.has(query)) return query;
    const branch = this.#branchId();
    if (branch && ids.has(branch)) return branch;
    return locations[0].id;
  });

  readonly availability = rxResource({
    params: () => this.$locationId() ?? undefined,
    stream: ({ params }) => this.#service.getAvailability(params).pipe(toRemoteResult()),
  });
  readonly $current = computed(() => resultValue(this.availability.value()) ?? []);
  readonly $byProduct = computed(() => new Map(this.$current().map((item) => [item.productId, item])));
  readonly $availabilityError = computed(() => resultError(this.availability.value()));

  // Búsqueda de productos vendibles (mismo filtro que el POS).
  readonly $search = signal('');
  readonly #debouncedSearch = toSignal(
    toObservable(this.$search).pipe(
      map((value) => value.trim()),
      debounceTime(300),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
  readonly products = rxResource({
    params: () => ({ name: this.#debouncedSearch() }),
    stream: ({ params }) => {
      let httpParams = new HttpParams().set('page', 1).set('perPage', SEARCH_PAGE_SIZE).set('isActive', true).set('sellable', true);
      if (params.name) httpParams = httpParams.set('name', params.name);
      return this.#http
        .get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params: httpParams })
        .pipe(
          map(({ data }) => data.filter((product) => product.type !== 'modifier')),
          toRemoteResult(),
        );
    },
  });
  readonly $products = computed(() => resultValue(this.products.value()) ?? []);
  readonly $productsError = computed(() => resultError(this.products.value()));

  // Producto con una acción en curso.
  readonly $busyId = signal<number | null>(null);

  onLocationChange(event: Event) {
    const locationId = Number((event.target as HTMLSelectElement).value);
    this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: { locationId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onSearch(event: Event) {
    this.$search.set((event.target as HTMLInputElement).value);
  }

  untilLabel(item: ProductAvailabilityDto): string {
    return formatSoldOutUntil(item.soldOutUntil, this.#timeZone());
  }

  choose(productId: number, choice: SoldOutChoice) {
    if (choice === 'hide') {
      this.#apply(productId, { isHidden: true }, 'Oculto en este local');
      return;
    }
    const soldOutUntil = soldOutUntilFor(choice, this.#timeZone());
    this.#apply(productId, { soldOut: true, soldOutUntil }, `Agotado ${formatSoldOutUntil(soldOutUntil, this.#timeZone())}`);
  }

  markAvailable(productId: number) {
    this.#apply(productId, { soldOut: false }, 'Disponible de nuevo');
  }

  show(productId: number) {
    this.#apply(productId, { isHidden: false }, 'Visible en este local');
  }

  #apply(productId: number, changes: Omit<UpdateProductAvailabilityDto, 'locationId'>, message: string) {
    const locationId = this.$locationId();
    if (!locationId || this.$busyId() !== null) return;
    this.$busyId.set(productId);
    this.#service.setAvailability(productId, { locationId, ...changes }).subscribe({
      next: () => {
        this.$busyId.set(null);
        this.#toast.show(message, 'success');
        this.availability.reload();
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo actualizar el producto.'), 'error');
      },
    });
  }
}
