import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, ModalCardComponent, SkeletonComponent, SlotDirective, ToastService } from 'src/ui';
import {
  DISCOUNT_DURATION_LABELS,
  DiscountDto,
  formatClp,
  formatPlatformDate,
  getPlatformErrorMessage,
  PlatformService,
  SubscriptionDetailDto,
} from '../../data-access';
import { BUSINESS_MODAL_CONFIG, BusinessModalData } from '../business-shared';

export type BusinessDiscountModalData = BusinessModalData & Readonly<{ subscription: SubscriptionDetailDto }>;

/** "20 %" o "$5.000". */
export function formatDiscountValue(discount: Pick<DiscountDto, 'type' | 'value'>): string {
  return discount.type === 'percent' ? `${discount.value} %` : formatClp(discount.value);
}

/** Asignar un descuento activo a la suscripción (reemplaza el actual). Devuelve true si guardó. */
@Component({
  selector: 'app-business-discount-modal',
  imports: [ButtonComponent, ModalCardComponent, SkeletonComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Asignar descuento</h2>
      </ng-template>

      <div class="space-y-3 p-2 text-sm">
        @if (data.subscription.discount; as current) {
          <p class="rounded-md bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
            Reemplaza el descuento actual: <strong>{{ current.name }}</strong> ({{ formatValue(current) }}).
          </p>
        }

        @if ($error()) {
          <div class="py-4 text-center">
            <p class="text-muted-foreground">No se pudieron cargar los descuentos.</p>
            <button type="button" class="text-primary mt-2 font-medium hover:underline" (click)="discounts.reload()">Reintentar</button>
          </div>
        } @else if (discounts.isLoading()) {
          @for (row of [1, 2, 3]; track row) {
            <app-skeleton size="sm" style="width: 100%" />
          }
        } @else if (!$discounts().length) {
          <p class="text-muted-foreground py-4 text-center">No hay descuentos activos. Créalos en Plataforma → Descuentos.</p>
        } @else {
          <fieldset class="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            <legend class="sr-only">Descuentos activos</legend>
            @for (discount of $discounts(); track discount.id) {
              @let warning = warningFor(discount);
              <label
                class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition"
                [class]="$discountId() === discount.id ? 'border-primary bg-primary/5' : 'border-[var(--border)]'">
                <input
                  type="radio"
                  name="discount"
                  class="mt-1 accent-[var(--primary)]"
                  [checked]="$discountId() === discount.id"
                  (change)="$discountId.set(discount.id)" />
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="text-foreground font-medium">{{ discount.name }}</span>
                    @if (discount.code) {
                      <span class="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs">{{ discount.code }}</span>
                    }
                  </span>
                  <span class="text-muted-foreground block text-xs">
                    {{ formatValue(discount) }} · {{ durationLabel(discount) }} · {{ discount.redemptions }}{{ discount.maxRedemptions !== null ? ' de ' + discount.maxRedemptions : '' }} usos
                    @if (discount.validUntil) {
                      · hasta el {{ formatDate(discount.validUntil) }}
                    }
                  </span>
                  @if (warning) {
                    <span class="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-300">{{ warning }}</span>
                  }
                </span>
              </label>
            }
          </fieldset>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving() || !$discountId()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">Asignar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class BusinessDiscountModalComponent {
  readonly dialogRef = inject<MatDialogRef<BusinessDiscountModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<BusinessDiscountModalData>(MAT_DIALOG_DATA);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatValue = formatDiscountValue;
  readonly formatDate = formatPlatformDate;

  readonly discounts = rxResource({ stream: () => this.#platform.getDiscounts({ isActive: true, perPage: 100 }).pipe(toRemoteResult()) });
  readonly $error = computed(() => resultError(this.discounts.value()));
  readonly $discounts = computed(() => resultValue(this.discounts.value())?.data ?? []);
  readonly $discountId = signal<number | null>(null);
  readonly $isSaving = signal(false);

  durationLabel(discount: DiscountDto): string {
    if (discount.duration === 'repeating') return `${discount.durationPeriods ?? '?'} cobros`;
    return DISCOUNT_DURATION_LABELS[discount.duration];
  }

  /** Aviso (no bloquea: lo decide el backend) cuando el descuento probablemente no aplica. */
  warningFor(discount: DiscountDto): string | null {
    const { subscription, businessId } = this.data;
    const now = Date.now();
    if (discount.businessIds?.length && !discount.businessIds.includes(businessId)) return 'Es exclusivo de otros negocios.';
    if (discount.planIds?.length && !discount.planIds.includes(subscription.plan.id)) return 'No incluye el plan actual del negocio.';
    if (discount.intervals?.length && subscription.price && !discount.intervals.includes(subscription.price.interval)) return 'No incluye el intervalo del precio actual.';
    if (discount.validFrom && new Date(discount.validFrom).getTime() > now) return `Vigente desde el ${formatPlatformDate(discount.validFrom)}.`;
    if (discount.validUntil && new Date(discount.validUntil).getTime() < now) return 'Su vigencia ya terminó.';
    if (discount.maxRedemptions !== null && discount.redemptions >= discount.maxRedemptions) return 'Ya no tiene usos disponibles.';
    return null;
  }

  handleSubmit() {
    const discount = this.$discounts().find((item) => item.id === this.$discountId());
    if (this.$isSaving()) return;
    if (!discount) {
      this.#toast.show('Elige un descuento', 'warning');
      return;
    }
    this.$isSaving.set(true);
    this.#platform
      .assignDiscount(this.data.businessId, discount.id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#toast.show(`Descuento ${discount.name} asignado`, 'success');
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo asignar el descuento'), 'error');
        },
      });
  }
}

export function openBusinessDiscountModal(dialog: MatDialog, data: BusinessDiscountModalData): Observable<boolean | undefined> {
  return dialog.open<BusinessDiscountModalComponent, BusinessDiscountModalData, boolean>(BusinessDiscountModalComponent, { ...BUSINESS_MODAL_CONFIG, data }).afterClosed();
}
