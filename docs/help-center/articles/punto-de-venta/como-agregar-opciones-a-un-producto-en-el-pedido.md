---
category: punto-de-venta
title: ¿Cómo agrego opciones o modificadores a un producto en el pedido?
slug: como-agregar-opciones-a-un-producto-en-el-pedido
summary: Al tocar un producto con opciones se abre un modal para elegir agregados, cuántas veces va cada uno, una nota y la cantidad; luego puedes editar la línea.
module: pos
routes: [/pos, /orders/new, /orders/:id/add]
tags: [modificadores, opciones, agregados, extras, pos, nota]
position: 2
---

Los productos con modificadores muestran la etiqueta **Opciones** en su tarjeta. Al tocarlos, se abre un modal para elegir los agregados antes de sumarlos al pedido.

## Elegir las opciones

1. En **POS → Tomar pedido**, toca un producto con la etiqueta **Opciones**.
2. El modal muestra el nombre y el precio del producto, y cada set de opciones (por ejemplo, *Agregados*). Marca las opciones que quieras. Las opciones con costo muestran el valor que suman, por ejemplo *+$800*.
3. Si una opción va más de una vez, como doble queso, usa **+** y **−** junto a la opción. Cada opción puede ir hasta 10 veces por unidad.
4. En **Nota para cocina**, escribe una indicación o toca una nota rápida, como *sin cebolla* o *término medio*.
5. Ajusta la **Cantidad** (de 1 a 99).
6. Revisa el *Total estimado* y toca **Agregar**.

En el ticket, la línea muestra las opciones elegidas (por ejemplo, "+ Extra queso" o "+ 2 x Palta") y el precio por unidad con las opciones incluidas.

## Editar una línea

Toca el nombre del producto en la lista **Productos**. Las líneas que se pueden editar tienen el ícono de ajustes. El modal se abre con lo que habías elegido. Haz los cambios y toca **Guardar**.

Si agregas el mismo producto con otras opciones o con otra nota, queda en una línea aparte. Así, cocina sabe exactamente qué lleva cada uno.

## Buenas prácticas

- La nota de una línea aplica a todas sus unidades. Si solo una unidad lleva la nota, deja esa línea en 1 y vuelve a tocar el producto para agregar otra línea.
- Las opciones se configuran en **Carta → Modificadores**. Ahí también eliges los productos que las ofrecen.

## Errores comunes

- **"Una de las opciones elegidas ya no está disponible para [producto]. Vuelve a elegirlas."**: alguien cambió el set mientras tomabas el pedido. La carta se recarga sola. Edita la línea y vuelve a elegir las opciones.
- **"Hay una opción repetida en [producto]. Edítalo y vuelve a intentar."**: abre la línea, revisa las opciones y guarda de nuevo.
- **El producto no muestra Opciones**: el set no está vinculado a ese producto o no tiene opciones. Revísalo en **Carta → Modificadores → Productos**.
