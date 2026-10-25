import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { formatMenuPrice, getPublicMenuErrorMessage, MenuDailySpecialDto, MenuDynamicService } from 'src/app/modules/public-menu/data-access';
import { isAlreadyDeleted } from 'src/app/modules/public-menu/features/marketing-shared';
import {
  addDays,
  dynamicSaveError,
  formatShortDay,
  isDynamicStageMissing,
  MenuDynamicCatalog,
  MenuDynamicStageBannerComponent,
  productName,
  splitIso,
  todayIn,
} from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, EmptyStateComponent, IconComponent, SkeletonComponent, ToastService, ToggleComponent } from 'src/ui';
import { openDailySpecialFormModal } from './daily-special-form-modal.component';
import { openRestockPortionsModal } from './restock-portions-modal.component';

type DailyStatus = 'live' | 'upcoming' | 'ended' | 'soldOut';

const STATUS_LABELS: Record<DailyStatus, string> = { live: 'En la carta ahora', upcoming: 'Programado', ended: 'Terminó', soldOut: 'Agotado' };
const STATUS_CLASSES: Record<DailyStatus, string> = {
  live: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  upcoming: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  ended: 'bg-muted/60 text-muted-foreground',
  soldOut: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

type DayGroup = Readonly<{ date: string; label: string; items: MenuDailySpecialDto[] }>;

/** Pestaña Plato del día: por local, hoy y los próximos días, con porciones y cuenta regresiva. */
@Component({
  selector: 'app-menu-dynamic-daily',
  imports: [ButtonComponent, IconComponent, SkeletonComponent, EmptyStateComponent, ToggleComponent, CheckPermissionDirective, MenuDynamicStageBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-dynamic-daily.component.html',
})
export class MenuDynamicDailyComponent {
  readonly #service = inject(MenuDynamicService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly locationId = input.required<number>();
  readonly timeZone = input<string | null>(null);
  readonly catalog = input<MenuDynamicCatalog | null>(null);
  readonly catalogLoading = input(false);

  readonly PERMISSIONS = PERMISSIONS;
  readonly statusLabels = STATUS_LABELS;
  readonly statusClasses = STATUS_CLASSES;
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));
  readonly $today = computed(() => todayIn(this.timeZone()));

  readonly specials = rxResource({
    // from: YYYY-MM-DD de hoy en la zona del negocio
    params: () => ({ locationId: this.locationId(), from: this.$today() }),
    stream: ({ params }) => this.#service.getDailySpecials(params.locationId, params.from).pipe(toRemoteResult()),
  });
  readonly $list = linkedSignal(() => [...(resultValue(this.specials.value()) ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  readonly $groups = computed<DayGroup[]>(() => {
    const zone = this.timeZone();
    const today = this.$today();
    const tomorrow = addDays(today, 1);
    const groups = new Map<string, MenuDailySpecialDto[]>();
    for (const special of this.$list()) {
      const date = splitIso(special.startsAt, zone).date;
      groups.set(date, [...(groups.get(date) ?? []), special]);
    }
    return [...groups.entries()].map(([date, items]) => ({
      date,
      label: date === today ? `Hoy, ${formatShortDay(date, zone)}` : date === tomorrow ? `Mañana, ${formatShortDay(date, zone)}` : formatShortDay(date, zone),
      items,
    }));
  });
  readonly $error = computed(() => resultError(this.specials.value()));
  readonly $missing = computed(() => isDynamicStageMissing(this.$error()));
  readonly $errorMessage = computed(() => getPublicMenuErrorMessage(this.$error(), 'No se pudieron cargar los platos del día.'));
  readonly $loaded = computed(() => !!resultValue(this.specials.value()));
  readonly $locked = computed(() => !this.$canManage() || this.$missing());
  readonly $busyId = signal<number | null>(null);
  /** Plato del día con el que choca el que se está guardando (MENU_DAILY_SPECIAL_OVERLAP). */
  readonly $conflictId = signal<number | null>(null);

  /** Estado del backend (status y portionsLeft); sin ellos, se calcula aquí. */
  status(special: MenuDailySpecialDto): DailyStatus {
    const now = Date.now();
    const ended = special.status ? special.status === 'ended' : new Date(special.endsAt).getTime() <= now;
    if (ended) return 'ended';
    if (this.left(special) === 0) return 'soldOut';
    const scheduled = special.status ? special.status === 'scheduled' : new Date(special.startsAt).getTime() > now;
    return scheduled ? 'upcoming' : 'live';
  }

  left(special: MenuDailySpecialDto): number | null {
    if (special.portions === null) return null;
    return special.portionsLeft ?? Math.max(0, special.portions - special.portionsSold);
  }

  product(special: MenuDailySpecialDto): string {
    const name = this.catalog()?.productById.get(special.productId)?.name ?? special.productName ?? productName(null, special.productId);
    if (special.variationId === null) return name;
    const variation = this.catalog()?.productById.get(special.productId)?.variations.find((item) => item.id === special.variationId);
    return variation && variation.label !== name ? `${name} · ${variation.label}` : name;
  }

  hours(special: MenuDailySpecialDto): string {
    const zone = this.timeZone();
    const start = splitIso(special.startsAt, zone);
    const end = splitIso(special.endsAt, zone);
    return `${start.time} a ${end.time}${end.date !== start.date ? ' (del día siguiente)' : ''}`;
  }

  price(special: MenuDailySpecialDto): string {
    return special.price !== null ? formatMenuPrice(special.price) : 'Precio de la carta';
  }

  progress(special: MenuDailySpecialDto): number {
    if (!special.portions) return 0;
    return Math.min(100, Math.round((special.portionsSold / special.portions) * 100));
  }

  create() {
    this.#open();
  }

  edit(special: MenuDailySpecialDto) {
    this.#open(special);
  }

  restock(special: MenuDailySpecialDto) {
    if (this.$locked()) return;
    openRestockPortionsModal(this.#dialog, special)
      .pipe(filter((saved) => !!saved))
      .subscribe((saved) => this.#replace(saved!));
  }

  toggle(special: MenuDailySpecialDto, isActive: boolean) {
    if (this.$busyId() !== null || this.$locked()) return;
    this.$busyId.set(special.id);
    this.#replace({ ...special, isActive });
    this.#service.updateDailySpecial(special.id, { isActive }).subscribe({
      next: (saved) => {
        this.$busyId.set(null);
        this.#replace(saved);
        this.#toast.show(isActive ? 'Plato del día activado' : 'Plato del día desactivado', 'success');
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        this.#replace(special);
        const message = dynamicSaveError(error, 'No se pudo cambiar el plato del día.', this.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  remove(special: MenuDailySpecialDto) {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar plato del día',
          message: `¿Eliminar "${special.title}" (${this.product(special)})? Deja de mostrarse en la carta.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(special.id);
          return this.#service.deleteDailySpecial(special.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.$list.update((list) => list.filter((item) => item.id !== special.id));
          this.#toast.show('Plato del día eliminado', 'success');
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          if (isAlreadyDeleted(error) && !isDynamicStageMissing(error)) {
            this.$list.update((list) => list.filter((item) => item.id !== special.id));
            this.#toast.show('Ese plato del día ya no existía. Actualizamos la lista.', 'success');
            return;
          }
          const message = dynamicSaveError(error, 'No se pudo eliminar el plato del día.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  #open(special?: MenuDailySpecialDto) {
    if (this.$locked()) return;
    openDailySpecialFormModal(this.#dialog, {
      special,
      locationId: this.locationId(),
      timeZone: this.timeZone(),
      catalog: this.catalog,
      catalogLoading: this.catalogLoading,
      specials: this.$list(),
      onConflict: (id) => this.$conflictId.set(id),
    })
      .pipe(filter((saved) => !!saved))
      .subscribe(() => this.specials.reload());
  }

  #replace(special: MenuDailySpecialDto) {
    this.$list.update((list) => list.map((item) => (item.id === special.id ? special : item)));
  }
}
