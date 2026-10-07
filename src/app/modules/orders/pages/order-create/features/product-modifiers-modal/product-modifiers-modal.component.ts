import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective } from 'src/ui';
import { ProductModifierOptionDto, ProductModifierSetDto } from 'src/app/modules/products/pages/product-list/data-access';
import { formatCurrency } from '../../../order-list/ui';
import { CartItemConfig, CartModifier, MAX_MODIFIER_TIMES, QUICK_NOTES, unitPriceWithModifiers } from '../cart-line';

export type ProductModifiersModalData = Readonly<{
  name: string;
  basePrice: number;
  modifierSets: ProductModifierSetDto[];
  // Valores de la línea al editarla desde el ticket.
  initial?: CartItemConfig;
}>;

const MAX_PRODUCT_QUANTITY = 99;

/** Abre el modal de opciones; emite la configuración elegida o undefined si se cancela. */
export function openProductModifiersModal(dialog: MatDialog, data: ProductModifiersModalData): Observable<CartItemConfig | undefined> {
  return dialog
    .open<ProductModifiersModalComponent, ProductModifiersModalData, CartItemConfig>(ProductModifiersModalComponent, {
      width: '520px',
      maxWidth: '95vw',
      maxHeight: '92vh',
      autoFocus: false,
      data,
    })
    .afterClosed();
}

@Component({
  selector: 'app-product-modifiers-modal',
  standalone: true,
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './product-modifiers-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductModifiersModalComponent {
  private readonly dialogRef = inject<MatDialogRef<ProductModifiersModalComponent, CartItemConfig>>(MatDialogRef);
  readonly data = inject<ProductModifiersModalData>(MAT_DIALOG_DATA);

  readonly formatCurrency = formatCurrency;
  readonly quickNotes = QUICK_NOTES;
  readonly maxTimes = MAX_MODIFIER_TIMES;
  readonly maxQuantity = MAX_PRODUCT_QUANTITY;
  readonly sets = this.data.modifierSets.filter((set) => set.options.length > 0);
  readonly isEditing = !!this.data.initial;

  // Opciones marcadas: variationId → veces por unidad. Solo se conservan las que el producto aún ofrece.
  readonly $selected = signal<Record<number, number>>(this.initialSelection());
  readonly $quantity = signal(this.data.initial?.quantity ?? 1);
  readonly $note = signal(this.data.initial?.note ?? '');

  readonly $modifiers = computed<CartModifier[]>(() => {
    const selected = this.$selected();
    return this.sets.flatMap((set) =>
      set.options
        .filter((option) => selected[option.variationId])
        .map((option) => ({ variationId: option.variationId, name: option.name, price: option.price, quantity: selected[option.variationId] })),
    );
  });
  readonly $unitPrice = computed(() => unitPriceWithModifiers(this.data.basePrice, this.$modifiers()));
  readonly $total = computed(() => this.$unitPrice() * this.$quantity());

  timesOf(option: ProductModifierOptionDto): number {
    return this.$selected()[option.variationId] ?? 0;
  }

  toggle(option: ProductModifierOptionDto) {
    this.$selected.update((selected) => {
      const next = { ...selected };
      if (next[option.variationId]) delete next[option.variationId];
      else next[option.variationId] = 1;
      return next;
    });
  }

  changeTimes(option: ProductModifierOptionDto, delta: number) {
    this.$selected.update((selected) => {
      const current = selected[option.variationId];
      if (!current) return selected;
      return { ...selected, [option.variationId]: Math.min(MAX_MODIFIER_TIMES, Math.max(1, current + delta)) };
    });
  }

  changeQuantity(delta: number) {
    this.$quantity.update((quantity) => Math.min(MAX_PRODUCT_QUANTITY, Math.max(1, quantity + delta)));
  }

  // Las notas rápidas se suman a lo escrito ("sin palta, sin mayo").
  addQuickNote(note: string) {
    const current = this.$note().trim();
    if (current.toLowerCase().includes(note)) return;
    this.$note.set((current ? `${current}, ${note}` : note).slice(0, 120));
  }

  onNote(event: Event) {
    this.$note.set((event.target as HTMLInputElement).value);
  }

  handleCancel() {
    this.dialogRef.close();
  }

  handleConfirm() {
    this.dialogRef.close({ quantity: this.$quantity(), note: this.$note().trim(), modifiers: this.$modifiers() });
  }

  private initialSelection(): Record<number, number> {
    const offered = new Set(this.data.modifierSets.flatMap((set) => set.options.map((option) => option.variationId)));
    return (this.data.initial?.modifiers ?? [])
      .filter((mod) => offered.has(mod.variationId))
      .reduce<Record<number, number>>((acc, mod) => ({ ...acc, [mod.variationId]: mod.quantity }), {});
  }
}
