---
category: inventario
title: ¿Cómo registro una compra?
slug: como-registrar-una-compra
summary: Registra la factura del proveedor con sus ítems, costos e IVA. La compra suma stock al local y actualiza el costo promedio.
module: inventory
routes: [/inventory/purchases, /inventory/purchases/new]
tags: [compra, factura, proveedor, iva, costo promedio, cuentas por pagar, lote]
position: 3
---

Ve a **Inventario → Compras → Nueva compra**, completa los datos de la factura, agrega los ítems y toca **Registrar compra**. La compra suma stock en el local y actualiza el costo promedio.

## Paso a paso

1. Ve a **Inventario → Compras** y toca **Nueva compra** (también está en **Inventario → Stock**).
2. En *Datos de la compra* completa:
   - **Local**: dónde entra la mercadería.
   - **Proveedor** (opcional). Si no existe, toca **Nuevo proveedor**.
   - **N° de factura** y **Notas** (opcionales) y la **Fecha**.
3. En *Ítems comprados*, busca cada ítem por nombre en **Agregar ítem**. Solo aparecen ingredientes y productos con *Stock propio*.
4. En cada línea indica:
   - **Cantidad** y **Unidad**: puedes comprar en una subunidad (ej. kg) aunque el ítem esté en gramos; el sistema convierte.
   - **Costo unitario**: neto, sin IVA, por la unidad elegida.
   - **Lote / vencimiento** (opcional): anota el lote y la fecha si el producto vence.
5. En *Total y pago*, revisa el **IVA de la factura**. Redom sugiere un monto sobre el neto; escribe 0 si la factura es exenta o toca **Usar sugerido** para volver al cálculo.
6. **Vence**: fecha de pago de la factura. Si la dejas vacía, se usa la condición de pago del proveedor (o el mismo día si no hay proveedor).
7. **Pagada ahora**:
   - Encendido: se registra el pago del total con IVA. Elige el **Medio de pago** y una **Referencia** opcional. Si pagas en efectivo y usas la caja, el efectivo sale del turno abierto de ese local.
   - Apagado: la compra queda pendiente y se paga después en **Finanzas → Cuentas por pagar**.
8. Toca **Registrar compra**. Verás *"Compra registrada por $120.000 · pagada"* o *"… pendiente de pago"*.

## Errores comunes

- **"Elige un local."** o **"Agrega al menos un ítem."**: faltan datos obligatorios.
- **"… ya está en la lista. Ajusta su cantidad."**: cada ítem va una sola vez por compra.
- **"El IVA no puede ser negativo."**: usa 0 o un monto positivo.
- **"La unidad … no permite decimales"**: usa números enteros con esa unidad.
- **"Sin resultados. Solo aparecen ingredientes y productos con 'Stock propio'."**: cambia el *Control de stock* del producto en **Carta → Productos**.
- **"Esta fecha ya pasó: el lote quedará como vencido."**: revisa la fecha de vencimiento del lote.
