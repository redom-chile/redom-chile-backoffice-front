import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, forkJoin, switchMap } from 'rxjs';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { CustomerOrdersService, DeliveryZoneDto, getPublicMenuErrorMessage } from 'src/app/modules/public-menu/data-access';
import { formatKm, openDeliveryZoneFormModal, zoneSummary } from 'src/app/modules/public-menu/features/delivery-zone-form-modal';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, IconComponent, SkeletonComponent, ToastService, ToggleComponent } from 'src/ui';

const VISIBLE_COMMUNES = 4;

/** Zonas de reparto del local, en el orden en que se evalúan (la primera que calza aplica). */
@Component({
  selector: 'app-delivery-zone-list',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, ButtonComponent, IconComponent, SkeletonComponent, ToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .cdk-drag-preview {
      background: var(--card);
      border-radius: 0.75rem;
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
  template: `
    @let list = $list();
    <div class="glass-row flex flex-col gap-3 rounded-xl p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-foreground text-sm font-medium">Zonas de reparto</p>
          <p class="text-muted-foreground text-xs">Si una dirección calza en varias, se usa la primera. Arrastra para ordenar.</p>
        </div>
        @if (editable()) {
        <app-button impact="light" size="small" type="button" icon="add" (buttonClick)="create()">Nueva zona</app-button>
        }
      </div>

      @if ($needsCoordinates()) {
      <p class="flex flex-wrap items-center gap-x-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        <span>Las zonas por radio necesitan la latitud y longitud del local.</span>
        <button type="button" class="font-semibold underline" (click)="focusCoordinates()">Completarlas</button>
      </p>
      }
      @if (deliveryEnabled() && list && !$activeCount()) {
      <p class="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">Sin zonas activas no recibes pedidos de delivery.</p>
      }

      @if ($error()) {
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-muted-foreground text-sm">{{ $errorMessage() }}</p>
        <app-button impact="light" size="small" type="button" (buttonClick)="zones.reload()">Reintentar</app-button>
      </div>
      } @else if (!list) {
      <div class="space-y-2">
        <app-skeleton size="sm" style="width: 70%" />
        <app-skeleton size="sm" style="width: 50%" />
      </div>
      } @else if (!list.length) {
      <p class="text-muted-foreground text-sm">Aún no tienes zonas. Crea una por comunas o por radio desde el local.</p>
      } @else {
      <ul
        cdkDropList
        cdkDropListLockAxis="y"
        class="flex flex-col gap-2"
        [class.opacity-60]="zones.isLoading() || $isReordering()"
        [cdkDropListDisabled]="$isReordering() || !editable()"
        (cdkDropListDropped)="drop($event)">
        @for (zone of list; track zone.id) {
        <li cdkDrag class="bg-background/40 flex items-start gap-1.5 rounded-xl border border-[var(--border)] p-2.5" [class.opacity-60]="!zone.isActive">
          @if (editable()) {
          <button
            type="button"
            cdkDragHandle
            class="text-muted-foreground hover:text-foreground -ml-1 inline-flex h-9 w-6 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
            [attr.aria-label]="'Mover ' + zone.name"
            title="Arrastra para ordenar">
            <app-icon class="h-5 w-5">drag_indicator</app-icon>
          </button>
          }
          <div class="min-w-0 flex-1">
            <p class="text-foreground truncate text-sm font-semibold">{{ zone.name }}</p>
            <div class="mt-1 flex flex-wrap gap-1 text-xs">
              @for (commune of zone.communes.slice(0, visibleCommunes); track commune.id) {
              <span class="bg-muted/50 text-foreground rounded-full px-2 py-0.5">{{ commune.name }}</span>
              }
              @if (zone.communes.length > visibleCommunes) {
              <span class="bg-muted/50 text-muted-foreground rounded-full px-2 py-0.5" [title]="communeNames(zone)">+{{ zone.communes.length - visibleCommunes }}</span>
              }
              @if (zone.radiusKm) {
              <span class="inline-flex items-center gap-0.5 rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-700 dark:text-sky-300">
                <app-icon class="h-3.5 w-3.5" aria-hidden="true">radar</app-icon>{{ km(zone.radiusKm) }}
              </span>
              }
            </div>
            <p class="text-muted-foreground mt-1 text-xs">{{ summary(zone) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <app-toggle [checked]="zone.isActive" [disabled]="!editable() || $busyId() === zone.id" (changed)="setActive(zone, $event)" />
            @if (editable()) {
            <button type="button" class="text-muted-foreground hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-full" [attr.aria-label]="'Editar ' + zone.name" (click)="edit(zone)">
              <app-icon class="h-4 w-4">edit</app-icon>
            </button>
            <button
              type="button"
              class="text-muted-foreground inline-flex h-9 w-9 items-center justify-center rounded-full hover:text-red-600"
              [attr.aria-label]="'Eliminar ' + zone.name"
              [disabled]="$busyId() === zone.id"
              (click)="remove(zone)">
              <app-icon class="h-4 w-4">delete</app-icon>
            </button>
            }
          </div>
        </li>
        }
      </ul>
      }
    </div>
  `,
})
export class DeliveryZoneListComponent {
  readonly #service = inject(CustomerOrdersService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #document = inject(DOCUMENT);

  readonly locationId = input.required<number>();
  readonly deliveryEnabled = input(false);
  readonly hasCoordinates = input(false);
  readonly editable = input(false);

  readonly visibleCommunes = VISIBLE_COMMUNES;
  readonly summary = zoneSummary;
  readonly km = formatKm;

  readonly zones = rxResource({
    params: () => this.locationId(),
    stream: ({ params }) => this.#service.getDeliveryZones(params).pipe(toRemoteResult()),
  });
  readonly $list = linkedSignal(() => {
    const list = resultValue(this.zones.value());
    return list ? [...list].sort((a, b) => a.position - b.position || a.id - b.id) : null;
  });
  readonly $error = computed(() => resultError(this.zones.value()));
  readonly $errorMessage = computed(() => getPublicMenuErrorMessage(this.$error(), 'No se pudieron cargar las zonas.'));
  readonly $activeCount = computed(() => this.$list()?.filter((zone) => zone.isActive).length ?? 0);
  readonly $needsCoordinates = computed(() => !this.hasCoordinates() && !!this.$list()?.some((zone) => zone.radiusKm));
  readonly $busyId = signal<number | null>(null);
  readonly $isReordering = signal(false);

  communeNames(zone: DeliveryZoneDto): string {
    return zone.communes.map((commune) => commune.name).join(', ');
  }

  create() {
    this.#open();
  }

  edit(zone: DeliveryZoneDto) {
    this.#open(zone);
  }

  /** Solo se envían las zonas cuya posición cambió. */
  drop(event: CdkDragDrop<DeliveryZoneDto[]>) {
    const previous = this.$list();
    if (!previous || event.previousIndex === event.currentIndex) return;
    const reordered = [...previous];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    const next = reordered.map((zone, position) => ({ ...zone, position }));
    const moved = next.filter((zone) => previous.find((item) => item.id === zone.id)?.position !== zone.position);
    this.$list.set(next);
    if (!moved.length) return;
    this.$isReordering.set(true);
    forkJoin(moved.map((zone) => this.#service.updateDeliveryZone(zone.id, { position: zone.position }))).subscribe({
      next: () => {
        this.$isReordering.set(false);
        this.#toast.show('Orden guardado', 'success');
      },
      error: (error: unknown) => {
        this.$isReordering.set(false);
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo guardar el orden.'), 'error');
        this.zones.reload();
      },
    });
  }

  setActive(zone: DeliveryZoneDto, isActive: boolean) {
    if (this.$busyId() !== null) return;
    this.$busyId.set(zone.id);
    this.#replace({ ...zone, isActive });
    this.#service.updateDeliveryZone(zone.id, { isActive }).subscribe({
      next: (saved) => {
        this.$busyId.set(null);
        this.#replace(saved);
        this.#toast.show(isActive ? 'Zona activada' : 'Zona desactivada', 'success');
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        this.#replace(zone);
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo cambiar la zona.'), 'error');
      },
    });
  }

  remove(zone: DeliveryZoneDto) {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar zona',
          message: `¿Eliminar "${zone.name}"? Deja de ofrecerse el delivery a esa zona.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(zone.id);
          return this.#service.deleteDeliveryZone(zone.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.$list.update((list) => list?.filter((item) => item.id !== zone.id) ?? null);
          this.#toast.show('Zona eliminada', 'success');
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo eliminar la zona.'), 'error');
        },
      });
  }

  /** Lleva a los campos de latitud y longitud de la tarjeta del local. */
  focusCoordinates() {
    const field = this.#document.getElementById(`menu-${this.locationId()}-latitude`);
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field?.focus({ preventScroll: true });
  }

  #open(zone?: DeliveryZoneDto) {
    openDeliveryZoneFormModal(this.#dialog, { locationId: this.locationId(), zone, hasCoordinates: this.hasCoordinates() })
      .pipe(filter((saved) => !!saved))
      .subscribe(() => this.zones.reload());
  }

  #replace(zone: DeliveryZoneDto) {
    this.$list.update((list) => list?.map((item) => (item.id === zone.id ? zone : item)) ?? null);
  }
}
