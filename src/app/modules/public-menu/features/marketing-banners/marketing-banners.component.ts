import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, map, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { CategoryDto } from 'src/app/modules/products/pages/categories/data-access';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import {
  BannerDto,
  getPublicMenuErrorMessage,
  MenuMarketingService,
  MenuSettingsDto,
  MenuSettingsService,
  ModalFrequency,
} from 'src/app/modules/public-menu/data-access';
import { formatSchedule, SCHEDULE_STATUS_LABELS, scheduleStatus } from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { isAlreadyDeleted, isFeatureNotIncluded, MarketingLocation, marketingSaveError, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { flattenCategories } from 'src/app/modules/public-menu/features/marketing-target-picker';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ApiPathEnum } from 'src/environments';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  EmptyStateComponent,
  IconComponent,
  ImageThumbComponent,
  SkeletonComponent,
  ToastService,
  ToggleComponent,
} from 'src/ui';
import { BANNER_DISPLAY_LABELS, BANNER_TYPE_ICONS, BANNER_TYPE_LABELS, MODAL_FREQUENCIES, MODAL_FREQUENCY_LABELS } from './banner-format';
import { openBannerFormModal } from './banner-form-modal.component';

/** Pestaña Banners: carrusel de la carta y ventana de ofertas, en el orden de la lista. */
@Component({
  selector: 'app-marketing-banners',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ButtonComponent,
    IconComponent,
    ImageThumbComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ToggleComponent,
    CheckPermissionDirective,
    MarketingUpsellCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marketing-banners.component.html',
  styles: `
    .cdk-drag-preview {
      background: var(--card);
      border-radius: 1rem;
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    }
    .cdk-drag-placeholder {
      opacity: 0.35;
    }
    .cdk-drag-animating,
    .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
  `,
})
export class MarketingBannersComponent {
  readonly #service = inject(MenuMarketingService);
  readonly #settingsService = inject(MenuSettingsService);
  readonly #http = inject(HttpClient);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly locationId = input<number | null>(null);
  readonly locations = input<readonly MarketingLocation[]>([]);
  readonly timeZone = input<string | null>(null);

  readonly PERMISSIONS = PERMISSIONS;
  readonly typeLabels = BANNER_TYPE_LABELS;
  readonly typeIcons = BANNER_TYPE_ICONS;
  readonly displayLabels = BANNER_DISPLAY_LABELS;
  readonly frequencies = MODAL_FREQUENCIES;
  readonly frequencyLabels = MODAL_FREQUENCY_LABELS;
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));
  readonly $canManageSettings = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));

  // Se piden todos para poder reordenar sin desarmar el orden de los otros locales; el filtro es local.
  readonly banners = rxResource({ stream: () => this.#service.getBanners().pipe(toRemoteResult()) });
  readonly $all = linkedSignal(() => resultValue(this.banners.value()));
  readonly $list = computed(() => {
    const locationId = this.locationId();
    const all = this.$all();
    if (!all) return null;
    return locationId ? all.filter((banner) => banner.locationId === null || banner.locationId === locationId) : all;
  });
  readonly $error = computed(() => resultError(this.banners.value()));
  readonly $blocked = computed(() => isFeatureNotIncluded(this.$error()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.$error()));
  readonly $errorMessage = computed(() => getPublicMenuErrorMessage(this.$error(), 'No se pudieron cargar los banners.'));
  readonly $busyId = signal<number | null>(null);
  readonly $isReordering = signal(false);

  // Nombres de lo enlazado, solo si algún banner lo usa.
  readonly #categories = rxResource({
    params: () => (this.$all()?.some((banner) => banner.linkType === 'category') ? true : undefined),
    stream: () => this.#http.get<CategoryDto[]>(`${ApiPathEnum.RESTAURANT}/categories`).pipe(map(flattenCategories), toRemoteResult()),
  });
  readonly #products = rxResource({
    params: () => (this.$all()?.some((banner) => banner.linkType === 'product') ? true : undefined),
    stream: () =>
      this.#http
        .get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params: new HttpParams().set('page', 1).set('perPage', 100) })
        .pipe(
          map(({ data }) => data.map((product) => ({ id: product.id, name: product.name }))),
          toRemoteResult(),
        ),
  });
  readonly #names = computed(() => ({
    category: new Map((resultValue(this.#categories.value()) ?? []).map((item) => [item.id, item.name])),
    product: new Map((resultValue(this.#products.value()) ?? []).map((item) => [item.id, item.name])),
  }));

  // Frecuencia de la ventana de ofertas, por local.
  readonly settings = rxResource({ stream: () => this.#settingsService.getSettings().pipe(toRemoteResult()) });
  readonly $settings = linkedSignal(() => resultValue(this.settings.value()));
  readonly $settingsError = computed(() => resultError(this.settings.value()));
  readonly $frequencyRows = computed(() => {
    const locationId = this.locationId();
    const list = this.$settings() ?? [];
    return locationId ? list.filter((item) => item.locationId === locationId) : list;
  });
  readonly $hasModal = computed(() => !!this.$list()?.some((banner) => banner.display === 'modal'));
  readonly $savingFrequency = signal<number | null>(null);

  readonly #locationNames = computed(() => new Map(this.locations().map((location) => [location.id, location.name])));

  locationName(id: number | null): string {
    return id === null ? 'Todos los locales' : (this.#locationNames().get(id) ?? 'Local eliminado');
  }

  linkName(banner: BannerDto): string | null {
    if (banner.linkType === 'product' || banner.linkType === 'category') return banner.linkId ? (this.#names()[banner.linkType].get(banner.linkId) ?? null) : null;
    return null;
  }

  linkSummary(banner: BannerDto): string | null {
    switch (banner.linkType) {
      case 'product':
        return `Abre el producto ${this.linkName(banner) ?? ''}`.trim();
      case 'category':
        return `Abre la categoría ${this.linkName(banner) ?? ''}`.trim();
      case 'url':
        return `Abre ${banner.linkUrl?.replace(/^https?:\/\//, '') ?? ''}`;
      default:
        return null;
    }
  }

  schedule(banner: BannerDto) {
    return formatSchedule(banner, this.timeZone());
  }

  warning(banner: BannerDto): string | null {
    if (!banner.isActive) return 'Inactivo: no se muestra';
    const status = scheduleStatus(banner, this.timeZone());
    return status === 'live' ? null : SCHEDULE_STATUS_LABELS[status];
  }

  create() {
    this.#open();
  }

  edit(banner: BannerDto) {
    this.#open(banner);
  }

  handleDrop(event: CdkDragDrop<BannerDto[]>) {
    const visible = this.$list();
    const all = this.$all();
    if (!visible || !all || event.previousIndex === event.currentIndex) return;
    const reordered = [...visible];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    // Los visibles toman los lugares que ya ocupaban; los de otros locales no se mueven.
    const visibleIds = new Set(visible.map((banner) => banner.id));
    let next = 0;
    const full = all.map((banner) => (visibleIds.has(banner.id) ? reordered[next++] : banner));
    const previous = all;
    this.$all.set(full);
    this.$isReordering.set(true);
    this.#service.reorderBanners(full.map((banner) => banner.id)).subscribe({
      next: (saved) => {
        this.$isReordering.set(false);
        if (saved?.length) this.$all.set(saved);
        this.#toast.show('Orden guardado', 'success');
      },
      error: (error: unknown) => {
        this.$isReordering.set(false);
        this.$all.set(previous);
        const message = marketingSaveError(error, 'No se pudo guardar el orden.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  toggle(banner: BannerDto, isActive: boolean) {
    if (this.$busyId() !== null) return;
    this.$busyId.set(banner.id);
    this.#replace({ ...banner, isActive });
    this.#service.updateBanner(banner.id, { isActive }).subscribe({
      next: (saved) => {
        this.$busyId.set(null);
        this.#replace(saved);
        this.#toast.show(isActive ? 'Banner activado' : 'Banner desactivado', 'success');
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        this.#replace(banner);
        const message = marketingSaveError(error, 'No se pudo cambiar el banner.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  remove(banner: BannerDto) {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: banner.display === 'modal' ? 'Eliminar ventana de ofertas' : 'Eliminar banner',
          message: `¿Eliminar "${banner.title}"? Deja de mostrarse en la carta.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(banner.id);
          return this.#service.deleteBanner(banner.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.$all.update((list) => list?.filter((item) => item.id !== banner.id) ?? null);
          this.#toast.show('Banner eliminado', 'success');
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          if (isAlreadyDeleted(error)) {
            this.$all.update((list) => list?.filter((item) => item.id !== banner.id) ?? null);
            this.#toast.show('Ese banner ya no existía. Actualizamos la lista.', 'success');
            return;
          }
          const message = marketingSaveError(error, 'No se pudo eliminar el banner.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  frequencyOf(settings: MenuSettingsDto): ModalFrequency {
    return settings.modalFrequency ?? 'once_per_visit';
  }

  setFrequency(settings: MenuSettingsDto, event: Event) {
    const select = event.target as HTMLSelectElement;
    const modalFrequency = select.value as ModalFrequency;
    const previous = this.frequencyOf(settings);
    if (modalFrequency === previous) return;
    this.$savingFrequency.set(settings.locationId);
    this.#settingsService.update(settings.locationId, { modalFrequency }).subscribe({
      next: (saved) => {
        this.$savingFrequency.set(null);
        this.$settings.update((list) => list?.map((item) => (item.locationId === saved.locationId ? saved : item)) ?? null);
        this.#toast.show('Frecuencia de la ventana guardada', 'success');
      },
      error: (error: unknown) => {
        this.$savingFrequency.set(null);
        select.value = previous;
        const message = marketingSaveError(error, 'No se pudo guardar la frecuencia.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  #open(banner?: BannerDto) {
    openBannerFormModal(this.#dialog, {
      banner,
      linkName: banner ? this.linkName(banner) : null,
      locations: this.locations(),
      timeZone: this.timeZone(),
      locationId: this.locationId(),
    })
      .pipe(filter((saved) => !!saved))
      .subscribe(() => this.banners.reload());
  }

  #replace(banner: BannerDto) {
    this.$all.update((list) => list?.map((item) => (item.id === banner.id ? banner : item)) ?? null);
  }
}
