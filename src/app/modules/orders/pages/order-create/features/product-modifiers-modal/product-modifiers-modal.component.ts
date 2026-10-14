import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getPublicMenuErrorMessage, MenuMarketingService, PackDto } from 'src/app/modules/public-menu/data-access';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ProductModifierOptionDto, ProductModifierSetDto } from 'src/app/modules/products/pages/product-list/data-access';
import { formatCurrency } from '../../../order-list/ui';
import {
  CartItemConfig,
  CartModifier,
  CartPackChoice,
  cartPricing,
  cartUnitPrice,
  MAX_MODIFIER_TIMES,
  packChoiceLabel,
  packExtras,
  QUICK_NOTES,
} from '../cart-line';

type PackGroup = PackDto['groups'][number];
type PackItem = PackGroup['items'][number];

export type ProductModifiersModalData = Readonly<{
  name: string;
  basePrice: number;
  modifierSets: ProductModifierSetDto[];
  // Valores de la línea al editarla desde el ticket.
  initial?: CartItemConfig;
  // Producto tipo pack: el modal carga sus grupos (GET /products/:id/pack) para elegir las opciones.
  packProductId?: number;
}>;

const MAX_PRODUCT_QUANTITY = 99;

/** Abre el modal de opciones; emite la configuración elegida o undefined si se cancela. */
export function openProductModifiersModal(dialog: MatDialog, data: ProductModifiersModalData): Observable<CartItemConfig | undefined> {
  return dialog
    .open<ProductModifiersModalComponent, ProductModifiersModalData, CartItemConfig>(ProductModifiersModalComponent, {
      width: '520px',
      maxWidth: '95vw',
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
  readonly packChoiceLabel = packChoiceLabel;

  // --- Pack ---
  private readonly toast = inject(ToastService);
  readonly isPack = this.data.packProductId !== undefined;
  readonly $pack = signal<PackDto | null>(null);
  // Grupos con una sola opción y mínimo ≥ 1: van incluidos, no se eligen.
  readonly $fixedGroups = computed(() => (this.$pack()?.groups ?? []).filter((group) => this.isFixed(group)));
  readonly $choiceGroups = computed(() => (this.$pack()?.groups ?? []).filter((group) => group.items.length > 0 && !this.isFixed(group)));
  // groupId → variationIds elegidos.
  readonly $packSelection = signal<Record<number, number[]>>({});
  readonly $packChoices = computed<CartPackChoice[]>(() => {
    const selection = this.$packSelection();
    const toChoice = (group: PackGroup, item: PackItem): CartPackChoice => ({
      groupId: group.id,
      variationId: item.variationId,
      name: item.name,
      quantity: item.quantity,
      extraPrice: item.extraPrice,
    });
    return [
      ...this.$fixedGroups().flatMap((group) => group.items.map((item) => toChoice(group, item))),
      ...this.$choiceGroups().flatMap((group) =>
        group.items.filter((item) => (selection[group.id] ?? []).includes(item.variationId)).map((item) => toChoice(group, item)),
      ),
    ];
  });
  readonly $packValid = computed(() => !!this.$pack() && this.$choiceGroups().every((group) => this.groupIsValid(group)));

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
  // Los precios del catálogo pueden ser netos: la estimación suma el IVA como el backend.
  readonly $pricing = cartPricing(inject(BusinessSettingsService));
  readonly $unitPrice = computed(() => cartUnitPrice(this.data.basePrice, this.$modifiers(), this.$pricing(), packExtras(this.$packChoices())));
  readonly $canConfirm = computed(() => !this.isPack || this.$packValid());

  constructor() {
    if (this.data.packProductId === undefined) return;
    inject(MenuMarketingService)
      .getPack(this.data.packProductId)
      .subscribe({
        next: (pack) => {
          this.$pack.set(pack);
          this.$packSelection.set(this.initialPackSelection(pack));
        },
        error: (error: unknown) => {
          this.toast.show(getPublicMenuErrorMessage(error, 'No se pudieron cargar las opciones del pack.'), 'error');
          this.dialogRef.close();
        },
      });
  }

  isPackItemSelected(group: PackGroup, item: PackItem): boolean {
    return (this.$packSelection()[group.id] ?? []).includes(item.variationId);
  }

  groupCount(group: PackGroup): number {
    return (this.$packSelection()[group.id] ?? []).length;
  }

  groupIsValid(group: PackGroup): boolean {
    const count = this.groupCount(group);
    return count >= group.minChoices && count <= group.maxChoices;
  }

  // "Elige 1", "Elige de 1 a 2", "Opcional, hasta 2"
  groupHint(group: PackGroup): string {
    if (group.minChoices === 0) return group.maxChoices === 1 ? 'Opcional' : `Opcional, hasta ${group.maxChoices}`;
    if (group.minChoices === group.maxChoices) return `Elige ${group.minChoices}`;
    return `Elige de ${group.minChoices} a ${group.maxChoices}`;
  }

  // Con máximo 1 se comporta como radio (si es opcional, tocar de nuevo la quita).
  togglePackItem(group: PackGroup, item: PackItem) {
    this.$packSelection.update((selection) => {
      const current = selection[group.id] ?? [];
      const selected = current.includes(item.variationId);
      let next: number[];
      if (group.maxChoices === 1) next = selected && group.minChoices === 0 ? [] : [item.variationId];
      else if (selected) next = current.filter((id) => id !== item.variationId);
      else if (current.length >= group.maxChoices) return selection;
      else next = [...current, item.variationId];
      return { ...selection, [group.id]: next };
    });
  }

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
    if (!this.$canConfirm()) return;
    this.dialogRef.close({
      quantity: this.$quantity(),
      note: this.$note().trim(),
      modifiers: this.$modifiers(),
      ...(this.isPack ? { packChoices: this.$packChoices() } : {}),
    });
  }

  private isFixed(group: PackGroup): boolean {
    return group.items.length === 1 && group.minChoices >= 1;
  }

  // Al editar se conservan las elecciones que el pack aún ofrece; si no, las opciones por defecto.
  private initialPackSelection(pack: PackDto): Record<number, number[]> {
    const initial = this.data.initial?.packChoices ?? [];
    return pack.groups.reduce<Record<number, number[]>>((acc, group) => {
      const offered = new Set(group.items.map((item) => item.variationId));
      const kept = initial.filter((choice) => choice.groupId === group.id && offered.has(choice.variationId)).map((choice) => choice.variationId);
      const defaults = group.items.filter((item) => item.isDefault).map((item) => item.variationId);
      const chosen = (initial.length ? kept : defaults).slice(0, Math.max(0, group.maxChoices));
      return { ...acc, [group.id]: chosen };
    }, {});
  }

  private initialSelection(): Record<number, number> {
    const offered = new Set(this.data.modifierSets.flatMap((set) => set.options.map((option) => option.variationId)));
    return (this.data.initial?.modifiers ?? [])
      .filter((mod) => offered.has(mod.variationId))
      .reduce<Record<number, number>>((acc, mod) => ({ ...acc, [mod.variationId]: mod.quantity }), {});
  }
}
