import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, forkJoin, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  formatLoyaltyBalance,
  getLoyaltyErrorMessage,
  LoyaltyMechanic,
  LoyaltyRewardDto,
  LoyaltyService,
  REWARD_TYPE_ICONS,
  REWARD_TYPE_LABELS,
  rewardValueLabel,
} from 'src/app/modules/loyalty/data-access';
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
import { openRewardFormModal } from './reward-form-modal.component';

/** Pestaña Recompensas: en el orden en que se ofrecen en la caja. */
@Component({
  selector: 'app-loyalty-rewards',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, ButtonComponent, IconComponent, SkeletonComponent, EmptyStateComponent, ToggleComponent, CheckPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loyalty-rewards.component.html',
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
export class LoyaltyRewardsComponent {
  readonly #service = inject(LoyaltyService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly mechanic = input<LoyaltyMechanic | null>(null);
  readonly hasProgram = input(true);
  readonly createProgram = output<void>();

  readonly PERMISSIONS = PERMISSIONS;
  readonly typeLabels = REWARD_TYPE_LABELS;
  readonly typeIcons = REWARD_TYPE_ICONS;
  readonly valueLabel = rewardValueLabel;
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.LOYALTY.MANAGE));

  readonly rewards = rxResource({ stream: () => this.#service.getRewards().pipe(toRemoteResult()) });
  readonly $list = linkedSignal(() => {
    const list = resultValue(this.rewards.value());
    return list ? [...list].sort((a, b) => a.position - b.position || a.id - b.id) : null;
  });
  readonly $error = computed(() => resultError(this.rewards.value()));
  readonly $errorMessage = computed(() => getLoyaltyErrorMessage(this.$error(), 'No se pudieron cargar las recompensas.') ?? 'No se pudieron cargar las recompensas.');
  readonly $busyId = signal<number | null>(null);
  readonly $isReordering = signal(false);

  cost(reward: LoyaltyRewardDto): string {
    return formatLoyaltyBalance(reward.cost, this.mechanic());
  }

  create() {
    this.#open();
  }

  edit(reward: LoyaltyRewardDto) {
    this.#open(reward);
  }

  handleDrop(event: CdkDragDrop<LoyaltyRewardDto[]>) {
    const previous = this.$list();
    if (!previous || event.previousIndex === event.currentIndex) return;
    const reordered = [...previous];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    const next = reordered.map((reward, position) => ({ ...reward, position }));
    // Solo se envían las que cambiaron de lugar.
    const changed = next.filter((reward) => previous.find((item) => item.id === reward.id)?.position !== reward.position);
    this.$list.set(next);
    if (!changed.length) return;
    this.$isReordering.set(true);
    forkJoin(changed.map((reward) => this.#service.updateReward(reward.id, { position: reward.position }))).subscribe({
      next: () => {
        this.$isReordering.set(false);
        this.#toast.show('Orden guardado', 'success');
      },
      error: (error: unknown) => {
        this.$isReordering.set(false);
        const message = getLoyaltyErrorMessage(error, 'No se pudo guardar el orden.');
        if (message) this.#toast.show(message, 'error');
        this.rewards.reload();
      },
    });
  }

  toggle(reward: LoyaltyRewardDto, isActive: boolean) {
    if (this.$busyId() !== null) return;
    this.$busyId.set(reward.id);
    this.#replace({ ...reward, isActive });
    this.#service.updateReward(reward.id, { isActive }).subscribe({
      next: (saved) => {
        this.$busyId.set(null);
        this.#replace(saved);
        this.#toast.show(isActive ? 'Recompensa activada' : 'Recompensa desactivada', 'success');
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        this.#replace(reward);
        const message = getLoyaltyErrorMessage(error, 'No se pudo cambiar la recompensa.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  remove(reward: LoyaltyRewardDto) {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar recompensa',
          message: `¿Eliminar "${reward.name}"? Deja de ofrecerse en la caja; los canjes ya hechos se mantienen.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(reward.id);
          return this.#service.deleteReward(reward.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.$list.update((list) => list?.filter((item) => item.id !== reward.id) ?? null);
          this.#toast.show('Recompensa eliminada', 'success');
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          const message = getLoyaltyErrorMessage(error, 'No se pudo eliminar la recompensa.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  #open(reward?: LoyaltyRewardDto) {
    openRewardFormModal(this.#dialog, { reward, mechanic: this.mechanic() })
      .pipe(filter((saved) => !!saved))
      .subscribe(() => this.rewards.reload());
  }

  #replace(reward: LoyaltyRewardDto) {
    this.$list.update((list) => list?.map((item) => (item.id === reward.id ? reward : item)) ?? null);
  }
}
