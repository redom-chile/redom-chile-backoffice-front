import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { MenuDailySpecialDto, MenuDynamicService } from 'src/app/modules/public-menu/data-access';
import { dynamicSaveError } from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';

const QUICK = [5, 10, 20];

/** Suma porciones a un plato del día (PATCH portions con el nuevo total). */
@Component({
  selector: 'app-restock-portions-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Reponer porciones</h2>
      </ng-template>
      <form class="space-y-4 p-2" (submit)="$event.preventDefault(); handleSubmit()">
        <p class="text-muted-foreground text-sm">
          {{ special.title }}: van {{ special.portionsSold }} de {{ special.portions }} vendidas.
        </p>
        <div class="flex flex-wrap gap-2">
          @for (amount of quick; track amount) {
          <button
            type="button"
            class="h-9 rounded-full px-4 text-sm font-medium"
            [class]="$amount() === amount ? 'bg-primary text-primary-foreground' : 'glass-row text-foreground'"
            [attr.aria-pressed]="$amount() === amount"
            (click)="$amount.set(amount)">
            +{{ amount }}
          </button>
          }
        </div>
        <div>
          <label for="restock-amount" class="mb-1 block text-sm font-medium">Porciones a agregar</label>
          <input
            id="restock-amount"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="!$valid()"
            [value]="$amount() ?? ''"
            (input)="$amount.set($any($event.target).value === '' ? null : +$any($event.target).value)" />
          @if (!$valid()) {
          <p class="text-destructive mt-1 text-xs">Un número entero desde 1.</p>
          } @else {
          <p class="text-muted-foreground mt-1 text-xs">Quedarán {{ $total() }} en total ({{ $total() - special.portionsSold }} disponibles).</p>
          }
        </div>
      </form>
      <ng-template app-slot="footer">
        <div class="flex justify-end gap-2">
          <app-button type="button" impact="light" tone="primary" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" tone="primary" [disabled]="!$valid()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">Reponer</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class RestockPortionsModalComponent {
  readonly dialogRef = inject<MatDialogRef<RestockPortionsModalComponent, MenuDailySpecialDto>>(MatDialogRef);
  readonly special = inject<MenuDailySpecialDto>(MAT_DIALOG_DATA);
  readonly #service = inject(MenuDynamicService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly quick = QUICK;
  readonly $amount = signal<number | null>(5);
  readonly $valid = computed(() => {
    const amount = this.$amount();
    return amount !== null && Number.isInteger(amount) && amount >= 1;
  });
  readonly $total = computed(() => (this.special.portions ?? 0) + (this.$amount() ?? 0));
  readonly $isSaving = signal(false);

  handleSubmit() {
    if (!this.$valid() || this.$isSaving()) return;
    this.$isSaving.set(true);
    this.#service
      .updateDailySpecial(this.special.id, { portions: this.$total() })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (saved) => {
          this.#toast.show('Porciones repuestas', 'success');
          this.dialogRef.close(saved);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          const message = dynamicSaveError(error, 'No se pudieron reponer las porciones.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }
}

export function openRestockPortionsModal(dialog: MatDialog, special: MenuDailySpecialDto): Observable<MenuDailySpecialDto | undefined> {
  return dialog
    .open<RestockPortionsModalComponent, MenuDailySpecialDto, MenuDailySpecialDto>(RestockPortionsModalComponent, {
      width: '420px',
      maxWidth: '95vw',
      autoFocus: false,
      data: special,
    })
    .afterClosed();
}
