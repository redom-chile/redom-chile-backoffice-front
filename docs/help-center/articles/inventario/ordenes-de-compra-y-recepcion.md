---
category: inventario
title: ¿Cómo uso las órdenes de compra y recibo un pedido en partes?
slug: ordenes-de-compra-y-recepcion
summary: Crea una orden para pedirle a un proveedor y regístrala al recibir la mercadería, completa o en varias entregas.
module: inventory
routes: [/inventory/purchase-orders, /inventory/purchase-orders/new]
tags: [orden de compra, proveedor, recepcion, recepcion parcial, pedido a proveedor]
position: 4
---

Una orden de compra es el pedido que le haces a un proveedor. **No mueve stock**: al recibirla se registra una compra con lo que llegó, que suma stock y actualiza el costo promedio.

## Crear la orden

1. Ve a **Inventario → Órdenes de compra** y toca **Nueva orden**.
2. En *Datos de la orden* completa el **Local** (donde se recibirá), el **Proveedor**, el **N° de referencia** (ej. OC-0012), la **Fecha** y la **Entrega esperada**.
3. En *Ítems a pedir* agrega los ítems con cantidad, unidad y costo unitario neto (sin IVA). Al recibir puedes ajustar el costo.
4. Toca **Guardar borrador** o **Guardar y marcar como enviada**.

## Estados

- **Borrador** y **Enviada**: se pueden editar.
- **Parcial**: llegó una parte.
- **Recibida**: llegó todo.
- **Anulada**: ya no se puede editar ni recibir.

Si la entrega esperada pasó y falta recibir, la orden aparece como **Atrasada**.

## Recibir la mercadería

1. Abre la orden y toca **Recibir**.
2. Completa el **N° de factura**, la **Fecha**, el **IVA de la factura** y, si quieres, **Vence** y **Notas**.
3. En *¿Qué llegó?* marca las líneas recibidas. La cantidad viene precargada con lo pendiente: cámbiala si llegó menos. También puedes ajustar el costo e indicar **Lote** y **Vencimiento**.
4. Toca **Registrar recepción**.

Si llegó todo verás *"Orden recibida"*; si falta algo, *"Recepción parcial registrada"* y la orden queda **Parcial** para la próxima entrega. En la sección *Recepciones* de la orden ves cada compra generada.

Para recibir más de lo pedido, activa *Mostrar también las líneas completas (recibir de más)*.

## Anular

Toca **Anular**. Lo ya recibido se mantiene en el stock, pero lo pendiente se cierra y no se podrá recibir. No se puede deshacer.

## Errores comunes

- **"Marca al menos una línea para recibir."**: selecciona lo que llegó.
- **"Más de lo pendiente."**: es solo un aviso; revisa la cantidad.
- **"Una orden parcial ya no se puede editar."**: después de recibir algo, la orden no se edita.
- **"Hay un ítem repetido en la orden: suma sus cantidades en una sola línea."**
