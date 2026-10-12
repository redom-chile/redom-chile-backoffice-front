---
category: pedidos-y-cobros
title: ¿Cómo anulo un pago o cancelo un pedido?
slug: como-anular-un-pago-o-cancelar-un-pedido
summary: Anula un pago con un motivo desde el pedido o desde Pagos, y cancela un pedido abierto que no tenga pagos vigentes.
module: orders
routes: [/orders/:id, /payments]
tags: [anular pago, cancelar pedido, motivo, caja cerrada, propina liquidada]
position: 3
---

Para anular un pago, toca el ícono de bloqueo junto al pago e indica el motivo. Para cancelar un pedido, primero anula todos sus pagos vigentes y luego toca **Cancelar pedido**.

## Anular un pago

1. Abre el pedido desde **POS → Pedidos** y baja a la sección **Pagos**. También puedes ir a **POS → Pagos**, donde ves todos los cobros del negocio.
2. En la fila del pago, toca el ícono de bloqueo (**Anular pago**).
3. Escribe el **Motivo** o elige uno: *Error de digitación*, *Método de pago incorrecto*, *Cliente cambió la forma de pago* o *Pago duplicado*.
4. Toca **Anular pago**.

El pago queda como **Anulado**, con su motivo, y el monto vuelve al saldo del pedido. Si se pagó por productos, esos productos vuelven a quedar pendientes.

## Cancelar un pedido

1. Abre el pedido. Debe estar en estado **Abierto**.
2. Si tiene pagos vigentes, anúlalos primero.
3. Toca **Cancelar pedido** y confirma.

El pedido queda como **Cancelado** y la mesa se libera. Esta acción no se puede deshacer. Si tienes inventario activo y descuentas stock al ingresar el pedido, el stock vuelve al inventario. Lo que ya se preparó queda registrado como merma.

## Errores comunes

- **"Indica el motivo de la anulación"**: el motivo es obligatorio.
- **"El pedido tiene pagos registrados. Anúlalos antes de cancelarlo."**: anula los pagos vigentes en la sección **Pagos** del pedido.
- **"Abre la caja para devolver el efectivo"**: aparece solo si tienes activado *Caja y turnos* en **Negocio → Mi negocio → Punto de venta**. Para anular un pago en efectivo, la caja debe estar abierta, porque el dinero sale de ella. Se abre la ventana para abrir el turno y, al confirmar, la anulación continúa.
- **"Propina ya liquidada"**: la propina de ese pago ya se le pagó al equipo. Toca **Ver liquidación #N**, anula esa liquidación en **Finanzas → Propinas** y vuelve a anular el pago.
- **"El pedido ya no está abierto."**: solo se pueden cancelar pedidos abiertos. Un pedido pagado se cierra automáticamente.
- **"No tienes permiso para esta acción."**: tu rol no permite anular pagos ni cancelar pedidos.
