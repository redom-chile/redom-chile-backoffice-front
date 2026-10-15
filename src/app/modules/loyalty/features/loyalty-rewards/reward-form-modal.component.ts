import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import {
  formatLoyaltyBalance,
  getLoyaltyErrorMessage,
  LoyaltyMechanic,
  LoyaltyRewardDto,
  LoyaltyService,
  REWARD_TYPE_LABELS,
  RewardType,
  SaveLoyaltyRewardDto,
} from 'src/app/modules/loyalty/data-access';
import { readApiError } from 'src/app/core/utils/api-error';
import { MarketingTarget, MarketingTargetPickerComponent } from 'src/app/modules/public-menu/features/marketing-target-picker';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService, ToggleComponent } from 'src/ui';

export type RewardFormModalData = Readonly<{ reward?: LoyaltyRewardDto; mechanic: LoyaltyMechanic | null }>;

type Field = 'name' | 'value' | 'product' | 'cost';

const NAME_MAX = 80;
const TYPES: RewardType[] = ['discount_amount', 'discount_percent', 'free_product'];

export function openRewardFormModal(dialog: MatDialog, data: RewardFormModalData): Observable<LoyaltyRewardDto | undefined> {
  return dialog
    .open<RewardFormModalComponent, RewardFormModalData, LoyaltyRewardDto>(RewardFormModalComponent, {
      width: '560px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}

/** Crear o editar una recompensa. Devuelve la guardada (undefined = cancelado). */
@Component({
  selector: 'app-reward-form-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective, ToggleComponent, MarketingTargetPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ reward ? 'Editar recompensa' : 'Nueva recompensa' }}</h2>
      </ng-template>

      <form class="space-y-5 p-2" (submit)="$event.preventDefault(); save()">
        <div>
          <label for="reward-name" class="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            id="reward-name"
            type="text"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="show('name')"
            [maxLength]="nameMax"
            placeholder="Café gratis"
            [value]="$name()"
            (input)="$name.set($any($event.target).value)" />
          @if (show('name'); as error) {
          <p class="text-destructive mt-1 text-xs">{{ error }}</p>
          }
        </div>

        <div>
          <label for="reward-type" class="mb-1 block text-sm font-medium">Tipo *</label>
          <select id="reward-type" class="glass-input w-full rounded-md px-3 py-2" (change)="$type.set($any($event.target).value)">
            @for (type of types; track type) {
            <option [value]="type" [selected]="type === $type()">{{ typeLabels[type] }}</option>
            }
          </select>
        </div>

        @if ($type() === 'free_product') {
        <div>
          <label for="reward-product" class="mb-1 block text-sm font-medium">Producto *</label>
          <app-marketing-target-picker inputId="reward-product" type="variation" [(selected)]="$product" [invalid]="!!(show('product') ?? $productRejected())" />
          @if (show('product') ?? $productRejected(); as error) {
          <p class="text-destructive mt-1 text-xs">{{ error }}</p>
          }
          <p class="text-muted-foreground mt-1 text-xs">Se agrega a la venta con precio $0 y va a cocina como cualquier producto.</p>
        </div>
        } @else {
        <div>
          <label for="reward-value" class="mb-1 block text-sm font-medium">{{ $type() === 'discount_percent' ? 'Porcentaje de descuento *' : 'Monto del descuento (con IVA) *' }}</label>
          <div class="relative">
            <span class="text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm" [class]="$type() === 'discount_percent' ? 'right-3' : 'left-3'">
              {{ $type() === 'discount_percent' ? '%' : '$' }}
            </span>
            <input
              id="reward-value"
              type="number"
              inputmode="numeric"
              min="1"
              [max]="$type() === 'discount_percent' ? 100 : null"
              class="glass-input w-full rounded-md py-2"
              [class]="$type() === 'discount_percent' ? 'pl-3 pr-8' : 'pl-7 pr-3'"
              [class.border-red-500]="show('value')"
              [value]="$value() ?? ''"
              (input)="$value.set(num($event))" />
          </div>
          @if (show('value'); as error) {
          <p class="text-destructive mt-1 text-xs">{{ error }}</p>
          }
          <p class="text-muted-foreground mt-1 text-xs">Se aplica como descuento de la venta (no se suma a otro descuento).</p>
        </div>
        }

        <div>
          <label for="reward-cost" class="mb-1 block text-sm font-medium">Costo en {{ unitPlural }} *</label>
          <input
            id="reward-cost"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="show('cost')"
            [value]="$cost() ?? ''"
            (input)="$cost.set(num($event))" />
          @if (show('cost'); as error) {
          <p class="text-destructive mt-1 text-xs">{{ error }}</p>
          } @else if ($cost(); as cost) {
          <p class="text-muted-foreground mt-1 text-xs">El cliente la canjea con {{ balance(cost) }}.</p>
          }
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <div>
            <p class="text-sm font-medium">Activa</p>
            <p class="text-muted-foreground text-xs">Inactiva no se ofrece en la caja.</p>
          </div>
          <app-toggle ariaLabel="Recompensa activa" [checked]="$isActive()" (changed)="$isActive.set($event)" />
        </div>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-2">
          <app-button type="button" impact="light" tone="primary" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" tone="primary" [isLoading]="$isSaving()" (buttonClick)="save()">
            {{ reward ? 'Guardar' : 'Crear recompensa' }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class RewardFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<RewardFormModalComponent, LoyaltyRewardDto>>(MatDialogRef);
  readonly data = inject<RewardFormModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(LoyaltyService);
  readonly #toast = inject(ToastService);

  readonly reward = this.data.reward ?? null;
  readonly nameMax = NAME_MAX;
  readonly types = TYPES;
  readonly typeLabels = REWARD_TYPE_LABELS;
  readonly unitPlural = this.data.mechanic === 'stamps' ? 'sellos' : 'puntos';

  readonly $name = signal(this.reward?.name ?? '');
  readonly $type = signal<RewardType>(this.reward?.rewardType ?? 'discount_amount');
  readonly $value = signal<number | null>(this.reward && this.reward.rewardType !== 'free_product' ? this.reward.value : null);
  readonly $product = signal<MarketingTarget | null>(
    this.reward?.variationId ? { id: this.reward.variationId, name: this.reward.productName ?? `Producto #${this.reward.variationId}` } : null,
  );
  // El buscador ya pide solo productos a la venta; esto cubre uno que dejó de venderse.
  readonly $productRejected = linkedSignal<MarketingTarget | null, string | null>({ source: this.$product, computation: () => null });
  readonly $cost = signal<number | null>(this.reward?.cost ?? null);
  readonly $isActive = signal(this.reward?.isActive ?? true);

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $problems = computed(() => {
    const problems: Partial<Record<Field, string>> = {};
    const name = this.$name().trim();
    if (!name) problems.name = 'Ingresa el nombre.';
    else if (name.length > NAME_MAX) problems.name = `Hasta ${NAME_MAX} caracteres.`;
    const type = this.$type();
    const value = this.$value();
    if (type === 'free_product') {
      if (!this.$product()) problems.product = 'Elige el producto.';
    } else if (value === null || !(value > 0)) {
      problems.value = 'Ingresa un valor mayor que 0.';
    } else if (type === 'discount_percent' && value > 100) {
      problems.value = 'Hasta 100%.';
    }
    const cost = this.$cost();
    if (cost === null || !Number.isInteger(cost) || cost < 1) problems.cost = 'Ingresa un número entero de al menos 1.';
    return problems;
  });

  num(event: Event): number | null {
    const raw = (event.target as HTMLInputElement).value;
    return raw === '' ? null : Number(raw);
  }

  balance(amount: number): string {
    return formatLoyaltyBalance(amount, this.data.mechanic);
  }

  show(field: Field): string | null {
    return this.$submitted() ? (this.$problems()[field] ?? null) : null;
  }

  save() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) return;
    const type = this.$type();
    const dto: SaveLoyaltyRewardDto = {
      name: this.$name().trim(),
      rewardType: type,
      cost: this.$cost()!,
      isActive: this.$isActive(),
      ...(type === 'free_product' ? { variationId: this.$product()!.id } : { value: this.$value()!, variationId: null }),
    };
    this.$isSaving.set(true);
    const request = this.reward ? this.#service.updateReward(this.reward.id, dto) : this.#service.createReward(dto);
    request.subscribe({
      next: (saved) => {
        this.#toast.show(this.reward ? 'Recompensa actualizada' : 'Recompensa creada', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        if (type === 'free_product' && isNotForSale(error)) {
          this.$productRejected.set('Ese producto no se vende.');
          this.#toast.show('Revisa los campos marcados', 'warning');
          return;
        }
        const message = getLoyaltyErrorMessage(error, 'No se pudo guardar la recompensa.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }
}

// 400 del backend cuando la variación no es de un producto a la venta.
const isNotForSale = (error: unknown) => {
  const api = readApiError(error);
  return api.status === 400 && api.message.includes('product for sale');
};
