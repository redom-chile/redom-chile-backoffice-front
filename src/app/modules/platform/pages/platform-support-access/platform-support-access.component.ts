import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { readPage, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { formatPlatformDate, getPlatformErrorMessage, PlatformService, PlatformSupportAccessDto } from '../../data-access';
import { SupportAccessActionsService } from '../../features/support-access-actions';

const PER_PAGE = 20;

type SupportAccessQuery = Readonly<{ page: number; all: boolean }>;
type AccessStatus = Readonly<{ label: string; tone: string }>;

// Vigentes por defecto; ?active=false trae todos.
function toQuery(params: ParamMap): SupportAccessQuery {
  return { page: readPage(params), all: params.get('active') === 'false' };
}

/** Accesos de soporte (#50): negocios que autorizaron a Redom a gestionar su carta (SUPERADMIN). */
@Component({
  selector: 'app-platform-support-access',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, PaginationTableComponent, CheckPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-support-access.component.html',
})
export class PlatformSupportAccessComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #platform = inject(PlatformService);
  readonly #actions = inject(SupportAccessActionsService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatDate = formatPlatformDate;
  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly tabs: ReadonlyArray<{ all: boolean; label: string }> = [
    { all: false, label: 'Vigentes' },
    { all: true, label: 'Todos' },
  ];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });

  readonly accesses = rxResource({
    params: () => {
      const { page, all } = this.$query();
      return { page, perPage: PER_PAGE, active: !all };
    },
    stream: ({ params }) => this.#platform.getSupportAccesses(params).pipe(toRemoteResult()),
  });
  readonly $page = computed(() => resultValue(this.accesses.value()));
  readonly $error = computed(() => resultError(this.accesses.value()));
  readonly $errorMessage = computed(() => getPlatformErrorMessage(this.$error(), 'Intenta nuevamente.'));

  /** Acceso que se está terminando. */
  readonly $busyId = signal<number | null>(null);

  status(access: PlatformSupportAccessDto): AccessStatus {
    if (access.active) return { label: 'Vigente', tone: 'bg-green-500/15 text-green-700 dark:text-green-400' };
    if (access.endReason === 'revoked') return { label: 'Terminado', tone: 'bg-[var(--muted)] text-muted-foreground' };
    return { label: 'Vencido', tone: 'bg-[var(--muted)] text-muted-foreground' };
  }

  totalChanges(access: PlatformSupportAccessDto): number {
    return access.changes.created + access.changes.updated + access.changes.deleted;
  }

  handleTab(all: boolean) {
    this.#navigate({ page: null, active: all ? 'false' : null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  handleEnter(access: PlatformSupportAccessDto) {
    this.#actions.enter(access);
  }

  handleEnd(access: PlatformSupportAccessDto) {
    if (this.$busyId() !== null) return;
    this.$busyId.set(access.grantId);
    this.#actions
      .end(access)
      .pipe(
        finalize(() => this.$busyId.set(null)),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((reload) => {
        if (reload) this.accesses.reload();
      });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
