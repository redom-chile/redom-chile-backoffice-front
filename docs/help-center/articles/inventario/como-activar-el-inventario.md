---
category: inventario
title: ¿Cómo activo el inventario y qué significa cada opción?
slug: como-activar-el-inventario
summary: Activa el inventario en Mi negocio, pestaña Inventario, y elige si trabajas con recetas, cuándo se descuenta el stock y si permites stock negativo.
module: inventory
routes: [/business, /inventory]
tags: [activar inventario, configuracion, descontar stock, stock negativo, recetas]
position: 1
---

El inventario se activa en **Negocio → Mi negocio**, pestaña **Inventario**, con el interruptor *Activar inventario*. Ahí mismo eliges cómo se descuenta el stock.

## Activarlo

1. Ve a **Negocio → Mi negocio** y abre la pestaña **Inventario**.
2. Enciende **Activar inventario**. Verás el mensaje *"Inventario activado"* y aparece el menú **Inventario**.
3. Te aparecerán dos atajos: **Carga tu stock inicial** y **Crea tus unidades**. Es buena idea hacer ambos antes de vender.

Cada local tiene su propio stock y su costo promedio ponderado, que se recalcula con cada compra.

## Qué hace cada opción

- **Trabajar con ingredientes y recetas**: permite crear ingredientes (insumos con stock que no se venden) y platos que descuentan stock según su receta. Activa los menús *Ingredientes*, *Recetas* y *Producción*.
- **Descontar stock al vender**: cada venta descuenta stock del local donde se vende. Los productos con *Stock propio* descuentan 1 unidad por unidad vendida, y los platos *Por receta* descuentan sus ingredientes. Un plato sin receta no descuenta nada.
- **¿Cuándo?** (aparece al activar lo anterior):
  - *Al ingresar el pedido*: descuenta apenas el producto entra al pedido, también al agregar productos a un pedido abierto.
  - *Al pagar*: descuenta cuando el pedido queda pagado por completo.
  Cada línea del pedido descuenta una sola vez: si cambias esta opción, lo ya descontado no se vuelve a descontar.
- **Permitir stock negativo**: si está apagado, no se pueden registrar salidas que dejen el stock bajo cero. Un pedido (o el pago, si descuentas al pagar) sin stock suficiente se rechaza.

Si anulas un pedido, el stock vuelve como *Anulación de venta*.

## Aviso de recetas incompletas

Si tienes platos *Por receta* sin receta o con receta incompleta, verás el aviso *"X platos por receta no descontarán ingredientes completos"*, con un enlace a cada plato. Toca **Ir a recetas** para completarlas.

## Desactivarlo

Al apagar *Activar inventario* se pide confirmar: se oculta el menú Inventario y se apagan *Descontar stock al vender* e *Ingredientes y recetas*. El stock y los movimientos registrados no se borran.

## Errores comunes

- **"No hay stock suficiente de: …"** al vender: registra una compra o un ajuste, o activa *Permitir stock negativo*.
- **"Primero activa el inventario."**: las demás opciones solo se pueden encender con el inventario activo.
- **"El inventario no está activado"** al entrar a una pantalla de Inventario: toca **Activar inventario** y te lleva a esta pestaña.
