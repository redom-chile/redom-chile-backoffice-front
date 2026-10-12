---
category: pedidos-y-cobros
title: ¿Cómo cobro un pedido?
slug: como-cobrar-un-pedido
summary: Abre el cobro desde el POS o desde el pedido, elige el medio de pago, la propina y el monto; en efectivo, Redom calcula el vuelto.
module: orders
routes: [/pos, /orders/:id]
tags: [cobrar, pago, propina, vuelto, efectivo, pago parcial]
position: 1
---

Para cobrar un pedido, toca **Cobrar [saldo]** en el POS o **Cobrar** en el detalle del pedido. Luego elige el medio de pago y toca **Registrar**.

## Paso a paso

1. Abre el cobro desde una de estas pantallas:
   - **POS → Tomar pedido**: elige la mesa o la cuenta y toca **Cobrar $**. Si agregaste productos que todavía no envías, primero envíalos o quítalos.
   - **POS → Pedidos**: abre el pedido y toca **Cobrar**.
2. Revisa el resumen: *Total*, *Pagado* y *Saldo*.
3. Elige el método de pago: **Efectivo**, **Débito**, **Crédito**, **Transferencia** u **Otro**.
4. En *Monto a pagar*, toca **Todo el saldo**, **Mitad** o escribe otro monto.
5. Elige la propina: **Sin propina**, el porcentaje sugerido, **15 %** u **Otro**. La propina es voluntaria, se calcula sobre lo que pagas en este cobro y no suma al total del pedido.
6. Si el pago es en efectivo, indica el *Efectivo recibido*. Puedes usar **Exacto** o los montos redondeados que se sugieren, como $10.000 o $20.000, y Redom muestra el **Vuelto**.
7. Si quieres, agrega una nota y toca **Registrar $**.

Cuando el saldo llega a cero, verás **Cuenta pagada**. El pedido se cierra solo. Toca **Listo**.

## Pagos parciales

Si pagas menos que el saldo, verás "Pago parcial: quedará un saldo de…". Al registrar el pago, el modal queda listo para el siguiente pago, con el nuevo saldo cargado. Por ejemplo, para una cuenta de $30.000, registra $15.000 en débito y luego $15.000 en efectivo. Los cobros quedan en *Pagos registrados*. Toca **Terminar** si quieres cobrar el resto más tarde.

Si hay vuelto, aparece destacado en **Vuelto a entregar**. Toca **Continuar con el siguiente pago** para seguir.

El porcentaje de propina sugerida se configura en **Negocio → Mi negocio → Punto de venta**.

## Con Caja y turnos activado

Si activaste *Caja y turnos* en Mi negocio, cada cobro queda registrado en la caja abierta.

- **"La caja está cerrada: ábrela para cobrar"**: se abre la ventana para abrir el turno. Al abrirlo, el cobro se registra.
- **"¿Con qué caja cobras?"**: hay varias cajas abiertas. Elige una, y este equipo la recordará.

## Errores comunes

- **"El efectivo recibido no cubre el monto más la propina"**: aumenta el efectivo recibido o baja la propina.
- **"Revisa los montos: el pago no puede superar el saldo…"**: el monto supera lo pendiente.
- **"El pedido ya no está abierto o el pago ya fue anulado."**: recarga el pedido.
