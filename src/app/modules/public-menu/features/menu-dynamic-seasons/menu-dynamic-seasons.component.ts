import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { getPublicMenuErrorMessage, MenuDynamicService, MenuMarketingService, MenuSeasonDto } from 'src/app/modules/public-menu/data-access';
import { isAlreadyDeleted } from 'src/app/modules/public-menu/features/marketing-shared';
import {
  dynamicSaveError,
  formatShortDay,
  isDynamicStageMissing,
  MenuDynamicCatalog,
  MenuDynamicStageBannerComponent,
  namesSummary,
  productName,
  splitIso,
} from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, EmptyStateComponent, IconComponent, SkeletonComponent, ToastService, ToggleComponent } from 'src/ui';
import { openSeasonFormModal } from './season-form-modal.component';

type SeasonStatus = 'live' | 'upcoming' | 'ended';

const STATUS_LABELS: Record<SeasonStatus, string> = { live: 'En curso', upcoming: 'Próxima', ended: 'Terminó' };
const STATUS_CLASSES: Record<SeasonStatus, string> = {
  live: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  upcoming: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  ended: 'bg-muted/60 text-muted-foreground',
};

/** Pestaña Temporadas: destacados entre dos fechas (Fiestas Patrias, Navidad, verano…). */
@Component({
  selector: 'app-menu-dynamic-seasons',
  imports: [ButtonComponent, IconComponent, SkeletonComponent, EmptyStateComponent, ToggleComponent, CheckPermissionDirective, MenuDynamicStageBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-dynamic-seasons.component.html',
})
export class MenuDynamicSeasonsComponent {
  readonly #service = inject(MenuDynamicService);
  readonly #marketing = inject(MenuMarketingService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);

  readonly locationId = input.required<number>();
  readonly locationName = input('');
  readonly timeZone = input<string | null>(null);
  readonly catalog = input<MenuDynamicCatalog | null>(null);
  readonly catalogLoading = input(false);

  readonly PERMISSIONS = PERMISSIONS;
  readonly statusLabels = STATUS_LABELS;
  readonly statusClasses = STATUS_CLASSES;
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));

  readonly seasons = rxResource({
    params: () => this.locationId(),
    stream: ({ params }) => this.#service.getSeasons(params).pipe(toRemoteResult()),
  });
  // Primero las vigentes y próximas (por fecha); al final las que terminaron.
  readonly $list = linkedSignal(() => {
    const list = resultValue(this.seasons.value()) ?? [];
    const rank: Record<SeasonStatus, number> = { live: 0, upcoming: 1, ended: 2 };
    return [...list].sort((a, b) => rank[this.status(a)] - rank[this.status(b)] || a.startsAt.localeCompare(b.startsAt));
  });
  readonly $error = computed(() => resultError(this.seasons.value()));
  readonly $missing = computed(() => isDynamicStageMissing(this.$error()));
  readonly $errorMessage = computed(() => getPublicMenuErrorMessage(this.$error(), 'No se pudieron cargar las temporadas.'));
  readonly $loaded = computed(() => !!resultValue(this.seasons.value()));
  readonly $locked = computed(() => !this.$canManage() || this.$missing());
  readonly $busyId = signal<number | null>(null);

  // Banners para enlazar (solo con Marketing de la carta en el plan).
  readonly $hasBanners = computed(() => this.#entitlements.hasFeature('menu_marketing'));
  readonly banners = rxResource({
    params: () => (this.$hasBanners() ? this.locationId() : undefined),
    stream: ({ params }) => this.#marketing.getBanners({ locationId: params }).pipe(toRemoteResult()),
  });
  readonly $banners = computed(() => (this.$hasBanners() ? (resultValue(this.banners.value()) ?? []) : null));
  readonly #bannerNames = computed(() => new Map((this.$banners() ?? []).map((banner) => [banner.id, banner.title])));

  /** Estado del backend; sin él, se calcula aquí. */
  status(season: MenuSeasonDto): SeasonStatus {
    if (season.status) return season.status === 'active' ? 'live' : season.status === 'scheduled' ? 'upcoming' : 'ended';
    const now = Date.now();
    if (new Date(season.startsAt).getTime() > now) return 'upcoming';
    if (new Date(season.endsAt).getTime() <= now) return 'ended';
    return 'live';
  }

  range(season: MenuSeasonDto): string {
    const zone = this.timeZone();
    const start = splitIso(season.startsAt, zone).date;
    const end = splitIso(season.endsAt, zone).date;
    if (!start || !end) return '';
    return start === end ? formatShortDay(start, zone) : `${formatShortDay(start, zone, false)} al ${formatShortDay(end, zone, false)}`;
  }

  products(season: MenuSeasonDto): string {
    return namesSummary(season.productIds.map((id) => productName(this.catalog(), id)));
  }

  bannerName(season: MenuSeasonDto): string | null {
    if (season.bannerId === null) return null;
    return this.#bannerNames().get(season.bannerId) ?? 'Banner enlazado';
  }

  create() {
    this.#open();
  }

  edit(season: MenuSeasonDto) {
    this.#open(season);
  }

  toggle(season: MenuSeasonDto, isActive: boolean) {
    if (this.$busyId() !== null || this.$locked()) return;
    this.$busyId.set(season.id);
    this.#replace({ ...season, isActive });
    this.#service.updateSeason(season.id, { isActive }).subscribe({
      next: (saved) => {
        this.$busyId.set(null);
        this.#replace(saved);
        this.#toast.show(isActive ? 'Temporada activada' : 'Temporada desactivada', 'success');
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        this.#replace(season);
        const message = dynamicSaveError(error, 'No se pudo cambiar la temporada.', this.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  remove(season: MenuSeasonDto) {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar temporada',
          message: `¿Eliminar "${season.name}"? Sus destacados dejan de mostrarse.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(season.id);
          return this.#service.deleteSeason(season.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.$list.update((list) => list.filter((item) => item.id !== season.id));
          this.#toast.show('Temporada eliminada', 'success');
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          if (isAlreadyDeleted(error) && !isDynamicStageMissing(error)) {
            this.$list.update((list) => list.filter((item) => item.id !== season.id));
            this.#toast.show('Esa temporada ya no existía. Actualizamos la lista.', 'success');
            return;
          }
          const message = dynamicSaveError(error, 'No se pudo eliminar la temporada.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  #open(season?: MenuSeasonDto) {
    if (this.$locked()) return;
    openSeasonFormModal(this.#dialog, {
      season,
      locationId: this.locationId(),
      locationName: this.locationName(),
      timeZone: this.timeZone(),
      catalog: this.catalog,
      catalogLoading: this.catalogLoading,
      banners: this.$banners,
    })
      .pipe(filter((saved) => !!saved))
      .subscribe(() => this.seasons.reload());
  }

  #replace(season: MenuSeasonDto) {
    this.$list.update((list) => list.map((item) => (item.id === season.id ? season : item)));
  }
}
