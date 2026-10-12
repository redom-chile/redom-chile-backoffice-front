---
category: pedidos-y-cobros
title: ¿Cómo divido la cuenta por productos?
slug: como-dividir-la-cuenta-por-productos
summary: En el cobro, la pestaña Por productos permite que cada persona pague lo que consumió e imprimir una pre-cuenta por persona.
module: orders
routes: [/pos, /orders/:id]
tags: [dividir cuenta, por productos, pre-cuenta, precuenta, pago parcial, pagar por separado, cada uno paga, cuenta separada, separar cuenta]
position: 2
---

Para que cada persona pague lo que consumió, abre el cobro y elige la pestaña **Por productos**. Marca los productos de esa persona y registra el pago.

## Paso a paso

1. Abre el cobro con **Cobrar** desde el POS o desde el detalle del pedido.
2. Elige el método de pago.
3. Toca la pestaña **Por productos**.
4. En *Productos a pagar*, usa **+** y **−** para indicar cuántas unidades paga esta persona. Con **Todo** marcas todas las unidades pendientes de un producto. También puedes usar **Seleccionar todo** o **Limpiar**.
5. Revisa el *Total estimado*. El monto final lo calcula el sistema al cobrar.
6. Si quieres, toca **Pre-cuenta por persona** para imprimir el detalle de lo que paga esa persona.
7. Elige la propina y, si paga en efectivo, indica el efectivo recibido para ver el *Vuelto estimado*.
8. Toca **Registrar ≈ $**.

Después de cada pago, la lista se actualiza. Cada producto muestra cuánto falta, por ejemplo "Pagado 1 de 2 · Pendiente 1". Los productos ya pagados quedan agrupados en **Pagado**. Repite los pasos con la siguiente persona.

## Cómo funciona

- Cada producto se paga junto con sus modificadores.
- El monto incluye la parte proporcional del descuento del pedido.
- Un pago **Por monto** baja el saldo, pero no marca productos como pagados.
- Si anulas un pago, sus productos vuelven a quedar pendientes.

La pestaña **Por productos** solo aparece cuando el pedido permite cobrar por productos.

## Errores comunes

- **"Selecciona los productos a pagar"**: marca al menos un producto.
- **"Los productos superan el saldo porque hubo pagos por monto. Cobra el resto con 'Por monto'."**: ya se pagó parte de la cuenta por monto. Cobra lo que falta en la pestaña **Por monto**.
- **"No quedan productos pendientes. Cobra el saldo con 'Por monto'."**: todos los productos están pagados, pero queda saldo. Cóbralo por monto.
- **"Alguno de los productos ya fue pagado. Se actualizó la cuenta: revisa la selección."**: otra persona cobró esos productos al mismo tiempo. Revisa la selección y vuelve a intentarlo.
- **"No se pudo imprimir la precuenta"**: revisa que la impresora esté conectada y vuelve a intentarlo.
