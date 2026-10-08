import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { formatClp, getPlatformErrorMessage, PlatformPlanDto, PlatformService } from '../../data-access';
import { openPlanCreateModal } from '../../features/plan-create-modal';
import { activePlanPrices, PLAN_INTERVAL_SUFFIX, PlanBadgesComponent, subscriptionsLabel } from '../../features/plan-shared';

/** Planes (incluidos inactivos y a medida) en el orden de la landing. Arrastra para reordenar. */
@Component({
  selector: 'app-platform-plans',
  imports: [
    RouterLink,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    PlanBadgesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-plans.component.html',
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
})
export class PlatformPlansComponent {
  readonly #platform = inject(PlatformService);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly plans = rxResource({ stream: () => this.#platform.getPlans().pipe(toRemoteResult()) });
  readonly $error = computed(() => resultError(this.plans.value()));
  // Copia local para reordenar de inmediato (se revierte si el backend falla).
  readonly $items = linkedSignal<PlatformPlanDto[]>(() => [...(resultValue(this.plans.value()) ?? [])].sort((a, b) => a.position - b.position));
  readonly $isReordering = signal(false);

  readonly formatClp = formatClp;
  readonly intervalSuffix = PLAN_INTERVAL_SUFFIX;
  readonly activePrices = activePlanPrices;
  readonly subscriptionsLabel = subscriptionsLabel;

  errorMessage(error: unknown): string {
    return getPlatformErrorMessage(error, 'Intenta nuevamente.');
  }

  handleCreate() {
    openPlanCreateModal(this.#dialog).subscribe((plan) => {
      if (plan) void this.#router.navigate(['/platform/plans', plan.id]);
    });
  }

  handleDrop(event: CdkDragDrop<PlatformPlanDto[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const previous = this.$items();
    const next = [...previous];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.$items.set(next);
    this.$isReordering.set(true);
    this.#platform
      .reorderPlans(next.map((plan) => plan.id))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.$isReordering.set(false);
          this.#toast.show('Orden guardado', 'success');
        },
        error: (error: unknown) => {
          this.$isReordering.set(false);
          this.$items.set(previous);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo guardar el orden'), 'error');
        },
      });
  }
}
