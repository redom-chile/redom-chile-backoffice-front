import { WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { addConfiguredToCart, addToCart, CartLine, hasModifierSets, productPrice, updateCartLine } from './cart-line';
import { openProductModifiersModal } from './product-modifiers-modal';

/** Usado por /orders/new, /orders/:id/add y el POS: con opciones abre el modal, sin ellas suma 1 directo. */
export function addProductToCart(dialog: MatDialog, cart: WritableSignal<CartLine[]>, product: ProductDto) {
  if (!hasModifierSets(product)) {
    cart.update((lines) => addToCart(lines, product));
    return;
  }
  openProductModifiersModal(dialog, {
    name: product.name,
    basePrice: productPrice(product),
    modifierSets: product.modifierSets ?? [],
  }).subscribe((config) => {
    if (config) cart.update((lines) => addConfiguredToCart(lines, product, config));
  });
}

/** Reabre el modal con la línea precargada. Usa la carta actual si el producto está cargado (opciones al día). */
export function editCartLine(dialog: MatDialog, cart: WritableSignal<CartLine[]>, key: string, products: ProductDto[]) {
  const line = cart().find((current) => current.key === key);
  if (!line) return;
  const product = products.find((current) => current.id === line.productId);
  openProductModifiersModal(dialog, {
    name: line.name,
    basePrice: product ? productPrice(product) : line.basePrice,
    modifierSets: product?.modifierSets ?? line.modifierSets,
    initial: { quantity: line.quantity, note: line.note, modifiers: line.modifiers },
  }).subscribe((config) => {
    if (config) cart.update((lines) => updateCartLine(lines, key, config, product));
  });
}
