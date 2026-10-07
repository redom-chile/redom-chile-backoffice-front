import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { readDate, readId, readOption, readPage, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { formatCurrency, formatDateTime } from 'src/app/modules/orders/pages/order-list/ui';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { CashService, CashSessionFiltersDto, CashSessionListItemDto, CashSessionStatus, getCashErrorMessage } from '../../data-access';
import { CashDifferenceComponent } from '../../ui';
import { CashConceptsComponent, CashSessionFiltersComponent, SessionFilterOption, SessionFilters } from './ui';

const PER_PAGE = 20;
const STATUSES: readonly CashSessionStatus[] = ['open', 'closed'];

type SessionListQuery = SessionFilters & Readonly<{ page: number }>;

function toQuery(params: ParamMap): SessionListQuery {
  return {
    page: readPage(params),
    locationId: readId(params, 'locationId'),
    registerId: readId(params, 'registerId'),
    status: readOption(params, 'status', STATUSES),
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
  };
}

/** Historial de turnos de caja con filtros en la URL. Funciona aunque el módulo esté apagado. */
@Component({
  selector: 'app-cash-session-list',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    PaginationTableComponent,
    CashDifferenceComponent,
    CashSessionFiltersComponent,
    CashConceptsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-list.component.html',
})
export class CashSessionListComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #cash = inject(CashService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #locations = inject(GetAllBusinessLocationsService);

  readonly formatCurrency = formatCurrency;
  readonly formatDateTime = formatDateTime;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly $isModuleOff = computed(() => this.#settings.$isLoaded() && !this.#settings.$cashManagementEnabled());

  // Todas las cajas (también inactivas: pueden tener turnos antiguos); el filtro de caja usa las del local elegido.
  readonly #registers = rxResource({
    stream: () => this.#cash.getRegisters({ includeInactive: true }).pipe(catchError(() => of([]))),
  });

  readonly $locationOptions = computed<SessionFilterOption[]>(() =>
    (this.#locations.$locations() ?? []).map((location) => ({ id: location.id, name: location.name })),
  );
  readonly $registerOptions = computed<SessionFilterOption[]>(() => {
    const locationId = this.$query().locationId;
    const registers = this.#registers.value() ?? [];
    const multiLocation = new Set(registers.map((register) => register.locationId)).size > 1;
    return registers
      .filter((register) => !locationId || register.locationId === locationId)
      .map((register) => ({
        id: register.id,
        name: `${register.name}${!locationId && multiLocation ? ` · ${register.locationName}` : ''}${register.isActive ? '' : ' (inactiva)'}`,
      }));
  });

  readonly sessions = rxResource({
    params: (): CashSessionFiltersDto => {
      const { page, locationId, registerId, status, from, to } = this.$query();
      return {
        page,
        perPage: PER_PAGE,
        locationId: locationId ?? undefined,
        registerId: registerId ?? undefined,
        status: status ?? undefined,
        dateFrom: from ?? undefined,
        dateTo: to ?? undefined,
      };
    },
    stream: ({ params }) => this.#cash.getSessions(params).pipe(toRemoteResult()),
  });

  readonly $page = computed(() => resultValue(this.sessions.value()));
  readonly $sessions = computed<CashSessionListItemDto[]>(() => this.$page()?.data ?? []);
  readonly $error = computed(() => resultError(this.sessions.value()));
  readonly $errorMessage = computed(() => getCashErrorMessage(this.$error(), 'No se pudo cargar el historial de cajas.'));

  readonly $hasFilters = computed(() => {
    const { locationId, registerId, status, from, to } = this.$query();
    return [locationId, registerId, status, from, to].some((value) => value !== null);
  });

  open(session: CashSessionListItemDto) {
    this.#router.navigate(['/cash/sessions', session.id]);
  }

  handleFiltersChange(changes: Partial<SessionFilters>) {
    const params: Record<string, string | null> = { page: null };
    for (const [key, value] of Object.entries(changes)) params[key] = value === null || value === undefined ? null : String(value);
    this.#navigate(params);
  }

  handleClearFilters() {
    this.#navigate({ page: null, locationId: null, registerId: null, status: null, from: null, to: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
