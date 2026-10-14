import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, fromEvent, interval, merge, Observable, scan, Subject, switchMap, timer } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { readApiError } from 'src/app/core/utils/api-error';
import { RemoteResult, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { CustomerOrderDto, CustomerOrdersService, getPublicMenuErrorMessage, StaffTableRequestDto } from 'src/app/modules/public-menu/data-access';
import { CustomerOrderCardComponent, tableLabel } from 'src/app/modules/public-menu/features/customer-order-card';
import { CustomerOrderCountService } from 'src/app/modules/public-menu/features/customer-order-count';
import { CustomerOrderFeedbackComponent } from 'src/app/modules/public-menu/features/customer-order-feedback';
import { CustomerOrderRequestCardComponent, TABLE_REQUEST_TYPES } from 'src/app/modules/public-menu/features/customer-order-request-card';
import { openCustomerOrderRejectModal } from 'src/app/modules/public-menu/features/customer-order-reject-modal';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { OrderSound } from './order-sound';

type Tab = 'pending' | 'history' | 'requests' | 'feedback';
type Polled<T> = Readonly<{ locationId: number; items: T[] | null; error: unknown }>;

const TABS: readonly Tab[] = ['pending', 'history', 'requests', 'feedback'];

const POLL_MS = 7000;
const HISTORY_LIMIT = 50;

/** Pedidos de los clientes desde la mesa (pendientes con polling y aviso, e historial), solicitudes de las mesas y encuestas. */
@Component({
  selector: 'app-customer-orders',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    CheckPermissionDirective,
    CustomerOrderCardComponent,
    CustomerOrderRequestCardComponent,
    CustomerOrderFeedbackComponent,
    MarketingUpsellCardComponent,
  ],
  templateUrl: './customer-orders.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOrdersComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #document = inject(DOCUMENT);
  readonly #dialog = inject(MatDialog);
  readonly #service = inject(CustomerOrdersService);
  readonly #count = inject(CustomerOrderCountService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #locationsService = inject(GetAllBusinessLocationsService);
  readonly #branchId = inject(WhoamiService).$branchId;
  readonly #refresh$ = new Subject<void>();
  readonly #sound = new OrderSound(this.#document);

  readonly PERMISSIONS = PERMISSIONS;
  readonly historyLimit = HISTORY_LIMIT;
  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('table_ordering'));
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.CUSTOMER_ORDERS.MANAGE));

  // --- Local y pestaña (en la URL) ---
  readonly $locations = computed(() => (this.#locationsService.$locations() ?? []).filter((location) => location.isActive !== false));
  readonly $isLoadingLocations = computed(() => !!this.#locationsService.$isLoading() && !this.#locationsService.$locations());
  readonly #query = toSignal(this.#route.queryParamMap, { initialValue: this.#route.snapshot.queryParamMap });
  readonly $tab = computed<Tab>(() => {
    const tab = this.#query().get('tab') as Tab;
    return TABS.includes(tab) ? tab : 'pending';
  });
  // El de la URL; si no, la sucursal del usuario; si no, el primero.
  readonly $locationId = computed(() => {
    const locations = this.$locations();
    if (!locations.length) return null;
    const ids = new Set(locations.map((location) => location.id));
    const query = Number(this.#query().get('locationId')) || null;
    if (query && ids.has(query)) return query;
    const branch = this.#branchId();
    if (branch && ids.has(branch)) return branch;
    return locations[0].id;
  });

  /** Hora para "hace X min" (se actualiza sola). */
  readonly $now = signal(Date.now());

  // --- Pendientes y solicitudes: polling con la pestaña visible, desde cualquier pestaña para no perder avisos ---
  readonly pending = rxResource({
    params: () => (this.$hasFeature() ? (this.$locationId() ?? undefined) : undefined),
    stream: ({ params: locationId }) => this.#poll(locationId, () => this.#service.list({ locationId, status: ['pending'] })),
  });
  readonly requests = rxResource({
    params: () => (this.$hasFeature() ? (this.$locationId() ?? undefined) : undefined),
    stream: ({ params: locationId }) => this.#poll(locationId, () => this.#service.getTableRequests({ locationId, status: 'open' })),
  });
  /** Resueltos aquí: se ocultan sin esperar al siguiente ciclo. */
  readonly #resolved = signal<ReadonlySet<string>>(new Set());
  readonly $pending = computed(() => {
    const resolved = this.#resolved();
    return (this.pending.value()?.items ?? []).filter((order) => !resolved.has(order.id));
  });
  readonly $pendingLoaded = computed(() => !!this.pending.value()?.items);
  readonly $pendingError = computed(() => this.pending.value()?.error ?? null);

  /** Atendidas aquí: se ocultan sin esperar al siguiente ciclo. */
  readonly #attended = signal<ReadonlySet<number>>(new Set());
  readonly $requests = computed(() => {
    const attended = this.#attended();
    return (this.requests.value()?.items ?? []).filter((request) => !attended.has(request.id));
  });
  readonly $requestsLoaded = computed(() => !!this.requests.value()?.items);
  readonly $requestsError = computed(() => this.requests.value()?.error ?? null);

  /** Atendidas recientemente (las últimas 100), solo a pedido. */
  readonly $showAttended = signal(false);
  readonly attendedRequests = rxResource({
    params: () =>
      this.$hasFeature() && this.$tab() === 'requests' && this.$showAttended() ? (this.$locationId() ?? undefined) : undefined,
    stream: ({ params: locationId }) => this.#service.getTableRequests({ locationId, status: 'attended' }).pipe(toRemoteResult()),
  });
  readonly $attendedRequests = computed(() => resultValue(this.attendedRequests.value()) ?? []);
  readonly $attendedError = computed(() => resultError(this.attendedRequests.value()));

  // --- Historial ---
  readonly history = rxResource({
    params: () => (this.$hasFeature() && this.$tab() === 'history' ? (this.$locationId() ?? undefined) : undefined),
    stream: ({ params: locationId }) =>
      this.#service.list({ locationId, status: ['accepted', 'rejected', 'cancelled'], limit: HISTORY_LIMIT }).pipe(toRemoteResult()),
  });
  readonly $history = computed(() => resultValue(this.history.value()) ?? []);
  readonly $historyError = computed(() => resultError(this.history.value()));

  // --- Acciones ---
  readonly $busyId = signal<string | null>(null);
  readonly $attendingId = signal<number | null>(null);
  readonly $problems = signal<Readonly<Record<string, string>>>({});
  /** Último aceptado, para ir a la venta en el POS. */
  readonly $lastAccepted = signal<CustomerOrderDto | null>(null);

  #seen: { locationId: number; ids: Set<string> } | null = null;
  #seenRequests: { locationId: number; ids: Set<number> } | null = null;

  constructor() {
    interval(15000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.$now.set(Date.now()));
    inject(DestroyRef).onDestroy(() => this.#sound.destroy());

    effect(() => {
      const state = this.pending.value();
      const orders = state?.items;
      if (!state || !orders) return;
      untracked(() => this.#notifyNew(state.locationId, orders));
    });

    effect(() => {
      const state = this.requests.value();
      const requests = state?.items;
      if (!state || !requests) return;
      untracked(() => this.#notifyNewRequests(state.locationId, requests));
    });
  }

  selectTab(tab: Tab) {
    this.#navigate({ tab: tab === 'pending' ? null : tab });
  }

  onLocationChange(event: Event) {
    this.$lastAccepted.set(null);
    this.#navigate({ locationId: Number((event.target as HTMLSelectElement).value) });
  }

  refresh() {
    if (this.$tab() === 'history') this.history.reload();
    if (this.$tab() === 'requests' && this.$showAttended()) this.attendedRequests.reload();
    this.#refresh$.next();
  }

  toggleAttended() {
    this.$showAttended.update((show) => !show);
  }

  attend(request: StaffTableRequestDto) {
    if (this.$attendingId()) return;
    this.$attendingId.set(request.id);
    this.#service.attendTableRequest(request.id).subscribe({
      next: () => {
        this.$attendingId.set(null);
        this.#toast.show(`${request.table.name}: solicitud atendida`, 'success');
        this.#attended.update((ids) => new Set(ids).add(request.id));
        this.#refresh$.next();
        this.#count.refresh();
        if (this.$showAttended()) this.attendedRequests.reload();
      },
      error: (error: unknown) => {
        this.$attendingId.set(null);
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo marcar la solicitud como atendida.'), 'error');
      },
    });
  }

  problemOf(order: CustomerOrderDto): string | null {
    return this.$problems()[order.id] ?? null;
  }

  accept(order: CustomerOrderDto) {
    if (this.$busyId()) return;
    this.$busyId.set(order.id);
    this.#setProblem(order.id, null);
    this.#service.accept(order.id).subscribe({
      next: (accepted) => {
        this.$busyId.set(null);
        this.#toast.show(`Pedido de ${tableLabel(accepted)} aceptado`, 'success');
        this.$lastAccepted.set(accepted);
        this.#resolve(order.id);
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        const api = readApiError(error);
        if (api.code === 'CUSTOMER_ORDER_NOT_PENDING') {
          this.#toast.show('Otra persona ya resolvió este pedido', 'warning');
          this.#resolve(order.id);
          return;
        }
        if (api.code === 'TABLE_BLOCKED') {
          this.#setProblem(order.id, 'La mesa está bloqueada. Desbloquéala en Mesas para aceptarlo, o rechaza el pedido.');
          this.#toast.show('La mesa está bloqueada', 'error');
          return;
        }
        if (api.status === 400 || api.status === 404) {
          this.#setProblem(order.id, 'Algún producto cambió desde que se pidió (por ejemplo, se eliminó). Te sugerimos rechazarlo.');
          this.#toast.show('No se pudo aceptar el pedido', 'error');
          return;
        }
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo aceptar el pedido.'), 'error');
      },
    });
  }

  reject(order: CustomerOrderDto) {
    if (this.$busyId()) return;
    openCustomerOrderRejectModal(this.#dialog, order).subscribe((result) => {
      if (!result) return;
      if (result.order) this.#toast.show(`Pedido de ${tableLabel(result.order)} rechazado`, 'success');
      this.#resolve(order.id);
    });
  }

  #resolve(id: string) {
    this.#resolved.update((ids) => new Set(ids).add(id));
    this.#setProblem(id, null);
    this.#refresh$.next();
    this.#count.refresh();
    if (this.$tab() === 'history') this.history.reload();
  }

  #setProblem(id: string, text: string | null) {
    this.$problems.update((problems) => {
      const { [id]: _, ...rest } = problems;
      return text ? { ...rest, [id]: text } : rest;
    });
  }

  /** La primera carga de un local solo registra; después, sonido y aviso por los que no estaban. */
  #notifyNew(locationId: number, orders: CustomerOrderDto[]) {
    const ids = new Set(orders.map((order) => order.id));
    const previous = this.#seen?.locationId === locationId ? this.#seen.ids : null;
    this.#seen = { locationId, ids };
    if (!previous) return;
    const fresh = orders.filter((order) => !previous.has(order.id));
    if (!fresh.length) return;
    this.#sound.play();
    this.#toast.show(fresh.length === 1 ? `Nuevo pedido de ${tableLabel(fresh[0])}` : `${fresh.length} pedidos nuevos`, 'success');
    this.#count.refresh();
  }

  /** Igual que los pedidos: la primera carga de un local solo registra. */
  #notifyNewRequests(locationId: number, requests: StaffTableRequestDto[]) {
    const ids = new Set(requests.map((request) => request.id));
    const previous = this.#seenRequests?.locationId === locationId ? this.#seenRequests.ids : null;
    this.#seenRequests = { locationId, ids };
    if (!previous) return;
    const fresh = requests.filter((request) => !previous.has(request.id));
    if (!fresh.length) return;
    this.#sound.play();
    const [first] = fresh;
    this.#toast.show(
      fresh.length === 1 ? `${first.table.name}: ${TABLE_REQUEST_TYPES[first.type]?.label.toLowerCase() ?? 'nueva solicitud'}` : `${fresh.length} solicitudes nuevas`,
      'success',
    );
    this.#count.refresh();
  }

  /** Consulta cada POLL_MS con la pestaña del navegador visible; si un ciclo falla, mantiene la última lista y avisa. */
  #poll<T>(locationId: number, load: () => Observable<T[]>): Observable<Polled<T>> {
    const visible = () => this.#document.visibilityState !== 'hidden';
    return merge(
      timer(0, POLL_MS).pipe(filter(visible)),
      fromEvent(this.#document, 'visibilitychange').pipe(filter(visible)),
      this.#refresh$,
    ).pipe(
      switchMap(() => load().pipe(toRemoteResult())),
      scan<RemoteResult<T[]>, Polled<T>>(
        (state, result) => ({ locationId, items: result.ok ? result.value : state.items, error: result.ok ? null : result.error }),
        { locationId, items: null, error: null },
      ),
    );
  }

  #navigate(queryParams: Record<string, string | number | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
