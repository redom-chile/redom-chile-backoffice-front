---
category: inventario
title: ¿Cómo veo mi stock y el kardex?
slug: como-ver-mi-stock-y-el-kardex
summary: Revisa el stock, costo promedio y valor de cada ítem por local, los productos bajo mínimo, y cada entrada y salida en el kardex.
module: inventory
routes: [/inventory, /inventory/kardex, /inventory/documents]
tags: [stock, kardex, costo promedio, bajo minimo, movimientos, valor del inventario]
position: 6
---

El stock está en **Inventario → Stock** y el detalle de cada movimiento en **Inventario → Kardex**. Cada local tiene su propio stock y su costo promedio ponderado.

## Pantalla de stock

1. Ve a **Inventario → Stock**.
2. Elige el **Local** arriba. El local elegido se recuerda en las demás pantallas de inventario.
3. Usa los filtros: búsqueda por nombre o SKU, **Todos / Ingredientes / Productos** y **Solo bajo mínimo**.

Por cada ítem verás:

- **Stock**: en la unidad base (ej. gramos).
- **Costo promedio**: por unidad base. Se recalcula con cada compra.
- **Valor**: stock × costo promedio. Abajo aparece el *Valor del inventario (esta página)*.
- Etiqueta **Bajo mínimo** si el stock es igual o menor al stock mínimo del ingrediente o producto.
- Fecha del lote que vence antes y, si hay, la cantidad vencida (tócala para registrar la merma).

Cada fila tiene los botones **Comprar**, **Ajustar** y **Kardex**.

Arriba verás avisos como *"3 productos bajo mínimo"* (tócalo para filtrar) y *Por vencer / Vencidos*.

Aquí solo aparecen ingredientes y productos con *Control de stock* en *Stock propio*. Los platos *Por receta* no tienen stock propio: descuentan sus ingredientes.

## Kardex

El kardex muestra cada entrada y salida con su costo y el saldo que dejó.

1. Ve a **Inventario → Kardex**, o toca **Kardex** en un ítem para ver solo ese producto.
2. Filtra por **local**, **tipo** (Compra, Venta, Anulación de venta, Ajuste, Merma, Conteo, Transferencia), **Desde** y **Hasta**.
3. Para quitar el filtro de producto, toca la X en *Producto: …*.

Columnas: Fecha, Local, Producto, Tipo, Cantidad, Costo unit., Costo total, Saldo, Documento, Usuario y Notas.

En **Documento** puedes abrir la compra, ajuste, conteo, transferencia o producción que originó el movimiento, o el pedido si fue una venta.

## Errores comunes

- **"Todavía no hay productos con stock"**: crea ingredientes o productos con *Stock propio* y registra una compra o el stock inicial.
- **"Aún no tienes locales"**: el stock se lleva por local. Crea uno en **Negocio → Sucursales**.
- Un plato vendido no aparece en el kardex: solo aparecen sus ingredientes, y solo si *Descontar stock al vender* está activo y el plato tiene receta.
