import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { moveInList } from 'src/app/modules/products/shared';
import { CartaIcon, CartaIconName } from 'src/app/modules/public-menu/carta/ui/carta-icon';
import { formatTime, getPublicMenuErrorMessage, MenuDynamicService, MenuMomentDto } from 'src/app/modules/public-menu/data-access';
import { crossesMidnight, formatDays, scheduleStatus } from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { isAlreadyDeleted } from 'src/app/modules/public-menu/features/marketing-shared';
import {
  dynamicSaveError,
  isDynamicStageMissing,
  MenuDynamicCatalog,
  MenuDynamicMoveButtonsComponent,
  MenuDynamicStageBannerComponent,
  overlapMomentId,
} from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, EmptyStateComponent, IconComponent, SkeletonComponent, ToastService, ToggleComponent } from 'src/ui';
import { MOMENT_MODE_LABELS, momentIconLabel } from './moment-format';
import { openMomentFormModal } from './moment-form-modal.component';

/** Pestaña Momentos: franjas del día que destacan o filtran la carta del local. */
@Component({
  selector: 'app-menu-dynamic-moments',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ToggleComponent,
    CheckPermissionDirective,
    CartaIcon,
    MenuDynamicMoveButtonsComponent,
    MenuDynamicStageBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-dynamic-moments.component.html',
})
export class MenuDynamicMomentsComponent {
  readonly #service = inject(MenuDynamicService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly locationId = input.required<number>();
  readonly timeZone = input<string | null>(null);
  readonly catalog = input<MenuDynamicCatalog | null>(null);
  readonly catalogLoading = input(false);

  readonly PERMISSIONS = PERMISSIONS;
  readonly modeLabels = MOMENT_MODE_LABELS;
  readonly asIcon = (name: string) => name as CartaIconName;
  readonly iconLabel = momentIconLabel;
  readonly handleClass = 'text-muted-foreground inline-flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing';

  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));

  readonly moments = rxResource({
    params: () => this.locationId(),
    stream: ({ params }) => this.#service.getMoments(params).pipe(toRemoteResult()),
  });
  readonly $list = linkedSignal(() => [...(resultValue(this.moments.value()) ?? [])].sort((a, b) => a.position - b.position));
  readonly $error = computed(() => resultError(this.moments.value()));
  readonly $missing = computed(() => isDynamicStageMissing(this.$error()));
  readonly $errorMessage = computed(() => getPublicMenuErrorMessage(this.$error(), 'No se pudieron cargar los momentos.'));
  readonly $loaded = computed(() => !!resultValue(this.moments.value()));
  readonly $locked = computed(() => !this.$canManage() || this.$missing());

  readonly $busyId = signal<number | null>(null);
  readonly $reordering = signal(false);
  /** Momento con el que choca el que se está guardando (se resalta en la lista). */
  readonly $conflictId = signal<number | null>(null);

  time(moment: MenuMomentDto): string {
    const hours = `${formatTime(moment.startTime)} a ${formatTime(moment.endTime)}`;
    return crossesMidnight(moment.startTime, moment.endTime) ? `${hours} (del día siguiente)` : hours;
  }

  days(moment: MenuMomentDto): string {
    return formatDays(moment.days);
  }

  isLive(moment: MenuMomentDto): boolean {
    if (!moment.isActive) return false;
    return scheduleStatus({ startsAt: null, endsAt: null, daysOfWeek: moment.days, startTime: moment.startTime, endTime: moment.endTime }, this.timeZone()) === 'live';
  }

  counts(moment: MenuMomentDto): string {
    const parts: string[] = [];
    if (moment.categoryIds.length) parts.push(`${moment.categoryIds.length} ${moment.categoryIds.length === 1 ? 'categoría' : 'categorías'}`);
    if (moment.productIds.length) parts.push(`${moment.productIds.length} ${moment.productIds.length === 1 ? 'producto' : 'productos'}`);
    return parts.join(' · ') || 'Sin contenido';
  }

  create() {
    this.#open();
  }

  edit(moment: MenuMomentDto) {
    this.#open(moment);
  }

  toggle(moment: MenuMomentDto, isActive: boolean) {
    if (this.$busyId() !== null || this.$locked()) return;
    this.$busyId.set(moment.id);
    this.$conflictId.set(null);
    this.#replace({ ...moment, isActive });
    this.#service.updateMoment(moment.id, { isActive }).subscribe({
      next: (saved) => {
        this.$busyId.set(null);
        this.#replace(saved);
        this.#toast.show(isActive ? 'Momento activado' : 'Momento desactivado', 'success');
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        this.#replace(moment);
        this.$conflictId.set(overlapMomentId(error));
        const message = dynamicSaveError(error, 'No se pudo cambiar el momento.', this.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  remove(moment: MenuMomentDto) {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar momento',
          message: `¿Eliminar "${moment.name}"? La carta deja de cambiar en ese horario.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(moment.id);
          return this.#service.deleteMoment(moment.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.$list.update((list) => list.filter((item) => item.id !== moment.id));
          this.#toast.show('Momento eliminado', 'success');
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          if (isAlreadyDeleted(error) && !isDynamicStageMissing(error)) {
            this.$list.update((list) => list.filter((item) => item.id !== moment.id));
            this.#toast.show('Ese momento ya no existía. Actualizamos la lista.', 'success');
            return;
          }
          const message = dynamicSaveError(error, 'No se pudo eliminar el momento.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  drop(event: CdkDragDrop<unknown>) {
    this.#reorder(moveInList(this.$list(), event.previousIndex, event.currentIndex));
  }

  move(index: number, delta: number) {
    this.#reorder(moveInList(this.$list(), index, index + delta));
  }

  #reorder(next: MenuMomentDto[]) {
    const previous = this.$list();
    if (this.$reordering() || this.$locked() || next.map((item) => item.id).join() === previous.map((item) => item.id).join()) return;
    this.$list.set(next);
    this.$reordering.set(true);
    this.#service
      .reorderMoments(
        this.locationId(),
        next.map((item) => item.id),
      )
      .subscribe({
        next: (ordered) => {
          this.$reordering.set(false);
          if (Array.isArray(ordered) && ordered.length) this.$list.set(ordered);
          this.#toast.show('Orden guardado', 'success');
        },
        error: (error: unknown) => {
          this.$reordering.set(false);
          this.$list.set(previous);
          const message = dynamicSaveError(error, 'No se pudo guardar el orden.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  #open(moment?: MenuMomentDto) {
    if (this.$locked()) return;
    openMomentFormModal(this.#dialog, {
      moment,
      locationId: this.locationId(),
      moments: this.$list(),
      catalog: this.catalog,
      catalogLoading: this.catalogLoading,
      onConflict: (id) => this.$conflictId.set(id),
    })
      .pipe(filter((saved) => !!saved))
      .subscribe(() => this.moments.reload());
  }

  #replace(moment: MenuMomentDto) {
    this.$list.update((list) => list.map((item) => (item.id === moment.id ? moment : item)));
  }
}
