import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, fromEvent, interval, map, merge, scan, Subject, switchMap, timer } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { readApiError } from 'src/app/core/utils/api-error';
import { RemoteResult, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { CustomerOrderDto, CustomerOrdersService, getPublicMenuErrorMessage } from 'src/app/modules/public-menu/data-access';
import { CustomerOrderCardComponent, tableLabel } from 'src/app/modules/public-menu/features/customer-order-card';
import { CustomerOrderCountService } from 'src/app/modules/public-menu/features/customer-order-count';
import { openCustomerOrderRejectModal } from 'src/app/modules/public-menu/features/customer-order-reject-modal';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { OrderSound } from './order-sound';

type Tab = 'pending' | 'history';
type PendingState = Readonly<{ locationId: number; orders: CustomerOrderDto[] | null; error: unknown }>;

const POLL_MS = 7000;
const HISTORY_LIMIT = 50;

/** Pedidos de los clientes desde la mesa: pendientes para aceptar o rechazar (con polling y aviso) e historial. */
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
  readonly $tab = computed<Tab>(() => (this.#query().get('tab') === 'history' ? 'history' : 'pending'));
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

  // --- Pendientes: polling con la pestaña visible, también desde Historial para no perder avisos ---
  readonly pending = rxResource({
    params: () => (this.$hasFeature() ? (this.$locationId() ?? undefined) : undefined),
    stream: ({ params: locationId }) => {
      const visible = () => this.#document.visibilityState !== 'hidden';
      return merge(
        timer(0, POLL_MS).pipe(filter(visible)),
        fromEvent(this.#document, 'visibilitychange').pipe(filter(visible)),
        this.#refresh$,
      ).pipe(
        switchMap(() => this.#service.list({ locationId, status: ['pending'] }).pipe(toRemoteResult())),
        // Si un ciclo falla, se mantiene la última lista y se avisa.
        scan<RemoteResult<CustomerOrderDto[]>, PendingState>(
          (state, result) => ({ locationId, orders: result.ok ? result.value : state.orders, error: result.ok ? null : result.error }),
          { locationId, orders: null, error: null },
        ),
      );
    },
  });
  /** Resueltos aquí: se ocultan sin esperar al siguiente ciclo. */
  readonly #resolved = signal<ReadonlySet<string>>(new Set());
  readonly $pending = computed(() => {
    const resolved = this.#resolved();
    return (this.pending.value()?.orders ?? []).filter((order) => !resolved.has(order.id));
  });
  readonly $pendingLoaded = computed(() => !!this.pending.value()?.orders);
  readonly $pendingError = computed(() => this.pending.value()?.error ?? null);

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
  readonly $problems = signal<Readonly<Record<string, string>>>({});
  /** Último aceptado, para ir a la venta en el POS. */
  readonly $lastAccepted = signal<CustomerOrderDto | null>(null);

  #seen: { locationId: number; ids: Set<string> } | null = null;

  constructor() {
    interval(15000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.$now.set(Date.now()));
    inject(DestroyRef).onDestroy(() => this.#sound.destroy());

    effect(() => {
      const state = this.pending.value();
      if (!state?.orders) return;
      untracked(() => this.#notifyNew(state.locationId, state.orders!));
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
    this.#refresh$.next();
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

  #navigate(queryParams: Record<string, string | number | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
