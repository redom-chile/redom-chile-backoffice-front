import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, ModalCardComponent, SkeletonComponent, SlotDirective, ToastService } from 'src/ui';
import { formatClp, getPlatformErrorMessage, INTERVAL_LABELS, PlatformService } from '../../data-access';
import { BUSINESS_MODAL_CONFIG, BusinessModalData } from '../business-shared';

/** Cambiar el plan y el precio (crea la suscripción si el negocio no tiene). Devuelve true si guardó. */
@Component({
  selector: 'app-business-plan-modal',
  imports: [ButtonComponent, ModalCardComponent, SkeletonComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Cambiar plan</h2>
      </ng-template>

      <div class="space-y-4 p-2 text-sm">
        @if (!data.subscription) {
          <p class="rounded-md bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
            {{ data.businessName }} no tiene suscripción: se creará una <strong>activa</strong> con el plan y el precio que elijas.
          </p>
        } @else {
          <p class="text-muted-foreground">
            Plan actual: <span class="text-foreground font-medium">{{ data.subscription.plan.name }}</span>
            @if (data.subscription.price; as price) {
              ({{ formatClp(price.amount) }} {{ intervalLabels[price.interval].toLowerCase() }})
            } @else {
              (sin precio)
            }
          </p>
        }

        @if ($error()) {
          <div class="text-center">
            <p class="text-muted-foreground">No se pudieron cargar los planes.</p>
            <button type="button" class="text-primary mt-2 font-medium hover:underline" (click)="plans.reload()">Reintentar</button>
          </div>
        } @else if (plans.isLoading()) {
          <app-skeleton size="sm" style="width: 100%" />
          <app-skeleton size="sm" style="width: 100%" />
        } @else {
          <div>
            <label for="plan-select" class="mb-1 block font-medium">Plan *</label>
            <select id="plan-select" class="glass-input w-full rounded-md px-3 py-2" (change)="handlePlan($event)">
              <option value="" [selected]="!$planId()" disabled>Elige un plan</option>
              @for (plan of $plans(); track plan.id) {
                <option [value]="plan.id" [selected]="$planId() === plan.id">
                  {{ plan.name }}{{ plan.isFree ? ' (gratis)' : '' }}{{ plan.isPublic ? '' : ' (a medida)' }}
                </option>
              }
            </select>
          </div>

          @if ($plan(); as plan) {
            @if (plan.isFree) {
              <p class="text-muted-foreground">Plan gratis: no tiene precio.</p>
            } @else {
              <div>
                <label for="price-select" class="mb-1 block font-medium">Precio</label>
                <select id="price-select" class="glass-input w-full rounded-md px-3 py-2" (change)="handlePrice($event)">
                  @for (price of $prices(); track price.id) {
                    <option [value]="price.id" [selected]="$priceId() === price.id">
                      {{ formatClp(price.amount) }} · {{ intervalLabels[price.interval] }}
                    </option>
                  }
                  <option value="" [selected]="$priceId() === null">Sin precio</option>
                </select>
                @if (!$prices().length) {
                  <p class="text-muted-foreground mt-1 text-xs">Este plan todavía no tiene precios vigentes.</p>
                }
              </div>
            }
          }
          <p class="text-muted-foreground text-xs">Elegir un plan a mano cancela una bajada de plan programada.</p>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving() || !$planId()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">
            {{ data.subscription ? 'Cambiar plan' : 'Crear suscripción' }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class BusinessPlanModalComponent {
  readonly dialogRef = inject<MatDialogRef<BusinessPlanModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<BusinessModalData>(MAT_DIALOG_DATA);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatClp = formatClp;
  readonly intervalLabels = INTERVAL_LABELS;

  readonly plans = rxResource({ stream: () => this.#platform.getPlans().pipe(toRemoteResult()) });
  readonly $error = computed(() => resultError(this.plans.value()));
  // Activos; el plan actual también, aunque esté inactivo, para no perderlo de vista.
  readonly $plans = computed(() =>
    (resultValue(this.plans.value()) ?? []).filter((plan) => plan.isActive || plan.id === this.data.subscription?.plan.id),
  );

  readonly $planId = signal<number | null>(this.data.subscription?.plan.id ?? null);
  readonly $priceId = signal<number | null>(this.data.subscription?.price?.id ?? null);
  readonly $plan = computed(() => this.$plans().find((plan) => plan.id === this.$planId()) ?? null);
  readonly $prices = computed(() => (this.$plan()?.prices ?? []).filter((price) => price.isActive || price.id === this.data.subscription?.price?.id));
  readonly $isSaving = signal(false);

  handlePlan(event: Event) {
    const id = Number((event.target as HTMLSelectElement).value) || null;
    this.$planId.set(id);
    // Propone el precio vigente del mismo intervalo (o el primero); el actual si es de ese plan.
    const plan = this.$plan();
    const prices = this.$prices();
    const currentPriceId = this.data.subscription?.price?.id ?? null;
    if (!plan || plan.isFree) return this.$priceId.set(null);
    if (currentPriceId !== null && prices.some((price) => price.id === currentPriceId)) return this.$priceId.set(currentPriceId);
    const interval = this.data.subscription?.price?.interval ?? 'month';
    this.$priceId.set((prices.find((price) => price.interval === interval) ?? prices[0])?.id ?? null);
  }

  handlePrice(event: Event) {
    const id = Number((event.target as HTMLSelectElement).value);
    this.$priceId.set(id || null);
  }

  handleSubmit() {
    const plan = this.$plan();
    if (this.$isSaving()) return;
    if (!plan) {
      this.#toast.show('Elige un plan', 'warning');
      return;
    }
    const priceId = plan.isFree ? null : this.$priceId();
    const current = this.data.subscription;
    if (current && current.plan.id === plan.id && (current.price?.id ?? null) === priceId) {
      this.dialogRef.close(false);
      return;
    }
    this.$isSaving.set(true);
    this.#platform
      .updateSubscription(this.data.businessId, { planId: plan.id, priceId })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#toast.show(current ? `Plan cambiado a ${plan.name}` : `Suscripción creada en ${plan.name}`, 'success');
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo cambiar el plan'), 'error');
        },
      });
  }
}

export function openBusinessPlanModal(dialog: MatDialog, data: BusinessModalData): Observable<boolean | undefined> {
  return dialog.open<BusinessPlanModalComponent, BusinessModalData, boolean>(BusinessPlanModalComponent, { ...BUSINESS_MODAL_CONFIG, data }).afterClosed();
}
