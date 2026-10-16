import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { getPublicMenuErrorMessage, MenuMarketingService, PromotionDto } from 'src/app/modules/public-menu/data-access';
import { formatSchedule, SCHEDULE_STATUS_LABELS, scheduleStatus } from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { isAlreadyDeleted, isFeatureNotIncluded, MarketingLocation, marketingSaveError, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  EmptyStateComponent,
  IconComponent,
  SkeletonComponent,
  ToastService,
  ToggleComponent,
} from 'src/ui';
import { CHANNEL_LABELS, formatDiscount, TARGET_TYPE_LABELS, targetNameOf } from './promotion-format';
import { openPromotionFormModal } from './promotion-form-modal.component';

type ActiveFilter = 'all' | 'active' | 'inactive';

/** Pestaña Promociones: precios especiales por producto, variación o categoría. */
@Component({
  selector: 'app-marketing-promotions',
  imports: [ButtonComponent, IconComponent, SkeletonComponent, EmptyStateComponent, ToggleComponent, CheckPermissionDirective, MarketingUpsellCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marketing-promotions.component.html',
})
export class MarketingPromotionsComponent {
  readonly #service = inject(MenuMarketingService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly locationId = input<number | null>(null);
  readonly locations = input<readonly MarketingLocation[]>([]);
  readonly timeZone = input<string | null>(null);

  readonly PERMISSIONS = PERMISSIONS;
  readonly channelLabels = CHANNEL_LABELS;
  readonly targetLabels = TARGET_TYPE_LABELS;
  readonly targetNameOf = targetNameOf;
  readonly filters: { value: ActiveFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'Activas' },
    { value: 'inactive', label: 'Inactivas' },
  ];
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));

  readonly $filter = signal<ActiveFilter>('all');
  readonly promotions = rxResource({
    params: () => ({ locationId: this.locationId() ?? undefined, active: this.$filter() === 'all' ? undefined : this.$filter() === 'active' }),
    stream: ({ params }) => this.#service.getPromotions(params).pipe(toRemoteResult()),
  });
  readonly $list = linkedSignal(() => resultValue(this.promotions.value()));
  readonly $error = computed(() => resultError(this.promotions.value()));
  readonly $blocked = computed(() => isFeatureNotIncluded(this.$error()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.$error()));
  readonly $errorMessage = computed(() => getPublicMenuErrorMessage(this.$error(), 'No se pudieron cargar las promociones.'));
  readonly $busyId = signal<number | null>(null);

  readonly #locationNames = computed(() => new Map(this.locations().map((location) => [location.id, location.name])));

  locationName(id: number | null): string {
    return id === null ? 'Todos los locales' : (this.#locationNames().get(id) ?? 'Local eliminado');
  }

  discount(promotion: PromotionDto) {
    return formatDiscount(promotion);
  }

  schedule(promotion: PromotionDto) {
    return formatSchedule(promotion, this.timeZone());
  }

  warning(promotion: PromotionDto): string | null {
    if (!promotion.isActive) return null;
    const status = scheduleStatus(promotion, this.timeZone());
    return status === 'live' ? null : SCHEDULE_STATUS_LABELS[status];
  }

  create() {
    this.#open();
  }

  edit(promotion: PromotionDto) {
    this.#open(promotion);
  }

  toggle(promotion: PromotionDto, isActive: boolean) {
    if (this.$busyId() !== null) return;
    this.$busyId.set(promotion.id);
    this.#replace({ ...promotion, isActive });
    this.#service.updatePromotion(promotion.id, { isActive }).subscribe({
      next: (saved) => {
        this.$busyId.set(null);
        this.#replace(saved);
        this.#toast.show(isActive ? 'Promoción activada' : 'Promoción desactivada', 'success');
        if (this.$filter() !== 'all') this.promotions.reload();
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        this.#replace(promotion);
        const message = marketingSaveError(error, 'No se pudo cambiar la promoción.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  remove(promotion: PromotionDto) {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar promoción',
          message: `¿Eliminar "${promotion.name}"? Los precios vuelven a ser los normales.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(promotion.id);
          return this.#service.deletePromotion(promotion.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.$list.update((list) => list?.filter((item) => item.id !== promotion.id) ?? null);
          this.#toast.show('Promoción eliminada', 'success');
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          if (isAlreadyDeleted(error)) {
            this.$list.update((list) => list?.filter((item) => item.id !== promotion.id) ?? null);
            this.#toast.show('Esa promoción ya no existía. Actualizamos la lista.', 'success');
            return;
          }
          const message = marketingSaveError(error, 'No se pudo eliminar la promoción.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  #open(promotion?: PromotionDto) {
    openPromotionFormModal(this.#dialog, { promotion, locations: this.locations(), timeZone: this.timeZone(), locationId: this.locationId() })
      .pipe(filter((saved) => !!saved))
      .subscribe(() => this.promotions.reload());
  }

  #replace(promotion: PromotionDto) {
    this.$list.update((list) => list?.map((item) => (item.id === promotion.id ? promotion : item)) ?? null);
  }
}
