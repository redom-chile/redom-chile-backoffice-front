import { WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { addConfiguredToCart, addToCart, CartLine, hasModifierSets, isPackProduct, productPrice, productVarieties, updateCartLine } from './cart-line';
import { openProductModifiersModal } from './product-modifiers-modal';

/**
 * Usado por /orders/new, /orders/:id/add y el POS: con opciones, variedades o si es un pack abre el modal;
 * sin ellas suma 1 directo.
 */
export function addProductToCart(dialog: MatDialog, cart: WritableSignal<CartLine[]>, product: ProductDto) {
  const isPack = isPackProduct(product);
  const varieties = productVarieties(product);
  if (!isPack && !hasModifierSets(product) && !varieties.length) {
    cart.update((lines) => addToCart(lines, product));
    return;
  }
  openProductModifiersModal(dialog, {
    name: product.name,
    basePrice: productPrice(product),
    modifierSets: product.modifierSets ?? [],
    varieties,
    ...(isPack ? { packProductId: product.id } : {}),
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
    varieties: product ? productVarieties(product) : line.varieties,
    initial: { variationId: line.variationId, quantity: line.quantity, note: line.note, modifiers: line.modifiers, packChoices: line.packChoices },
    ...(line.isPack ? { packProductId: line.productId } : {}),
  }).subscribe((config) => {
    if (config) cart.update((lines) => updateCartLine(lines, key, config, product));
  });
}
