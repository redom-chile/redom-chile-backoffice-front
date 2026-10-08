---
category: punto-de-venta
title: ¿Cómo tomo un pedido en el POS?
slug: como-tomar-un-pedido-en-el-pos
summary: Elige mesa o venta sin mesa, toca los productos, agrega notas y envía el pedido a cocina desde POS → Tomar pedido.
module: pos
routes: [/pos, /orders/new, /orders/:id/add]
tags: [pos, pedido, mesa, comanda, cocina, carrito, notas]
position: 1
---

Para tomar un pedido, entra a **POS → Tomar pedido**, elige una mesa o **Sin mesa**, toca los productos y presiona **Enviar pedido**.

## Paso a paso

1. Si tienes varias sucursales, elige la sucursal arriba.
2. En **¿Quién atiende?**, toca tu nombre e ingresa tu PIN de 4 dígitos. Si en **Negocio → Mi negocio → Punto de venta** está apagado *Uso meseros*, el POS no lo pregunta; si está encendido *Mesero obligatorio al tomar pedidos*, no aparece la opción **Continuar sin mesero**.
3. En el panel **Mesas**, toca una mesa o **Sin mesa**. Si tienes varios sectores, puedes filtrar las mesas por sector. Las mesas bloqueadas no se pueden elegir.
4. Busca los productos con **Buscar producto…** o filtra por categoría. Si una categoría tiene subcategorías, aparece una segunda fila con **Todo [categoría]** y cada subcategoría.
5. Toca la tarjeta de un producto para agregarlo. El número sobre la tarjeta indica cuántas unidades llevas. Si la tarjeta dice **Opciones**, se abre un modal para elegirlas.
6. En **Productos**, usa **+** y **−** para cambiar la cantidad. Con una sola unidad, el botón de basurero quita el producto.
7. Para agregar una nota a un producto, toca el ícono de nota. Puedes escribir la nota o usar las notas rápidas: *sin palta*, *sin cebolla*, *bien cocido*, *para llevar*, etc.
8. Opcionalmente, elige un **Cliente** o crea uno nuevo, y escribe una **Nota general del pedido**.
9. Deja marcado **Enviar a cocina** si el pedido debe llegar a cocina, y toca **Enviar pedido**.

Verás el mensaje "Pedido [número] enviado". La cuenta queda abierta a la derecha, con el estado de cada producto y el **Saldo por pagar**.

## Agregar productos a una cuenta abierta

Toca una mesa ocupada para cargar su cuenta. Agrega los productos y toca **Agregar a la cuenta**. Si el pedido va a cocina, la comanda incluye solo los productos nuevos.

Desde **POS → Pedidos** también puedes abrir un pedido y tocar **Agregar productos**.

## Antes de enviar

El *Total estimado* es una referencia. El sistema confirma el total final al guardar el pedido. Si vendes con precios sin IVA, el total ya incluye el IVA.

Si cambias de mesero con productos sin enviar, se descartan. Antes de hacerlo, Redom te pide confirmar.

## Errores comunes

- **"Primero crea tu local"**: necesitas al menos una sucursal. Créala en **Negocio → Sucursales**.
- **"No hay meseros disponibles"**: el usuario necesita el rol *Mesero*, estar activo y estar asignado a esta sucursal o no tener sucursal asignada.
- **"La cuenta ya no está abierta: no se le pueden agregar productos."**: alguien cerró o canceló la cuenta. Toma un pedido nuevo.
- **"[Producto] ya no está a la venta…"**: quítalo del pedido y vuelve a enviar.
- **"La mesa está bloqueada y no puede recibir pedidos."**: elige otra mesa.
