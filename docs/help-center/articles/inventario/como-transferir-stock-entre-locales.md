---
category: inventario
title: ¿Cómo transfiero stock entre locales?
slug: como-transferir-stock-entre-locales
summary: Envía stock de un local a otro desde Inventario, Transferencias. Sale del origen a su costo promedio y entra al destino a ese mismo costo.
module: inventory
routes: [/inventory/transfers, /inventory/transfers/new]
tags: [transferencia, locales, sucursales, traspaso, enviar stock]
position: 8
---

Ve a **Inventario → Transferencias → Nueva transferencia**, elige el origen, el destino y los ítems, y toca **Registrar transferencia**.

El menú *Transferencias* aparece solo si tu negocio tiene más de un local. Si tienes uno solo, crea otra sucursal en **Negocio → Sucursales**.

## Paso a paso

1. Ve a **Inventario → Transferencias** y toca **Nueva transferencia**.
2. En *Datos de la transferencia* elige el **Origen** y el **Destino**. El botón **Intercambiar** los da vuelta.
3. Elige la **Fecha** y, si quieres, **Notas** (ej. "reposición del fin de semana").
4. En *Ítems a transferir* busca cada ítem y escribe la cantidad. Debajo de cada línea verás el *Stock en origen*; si no alcanza, aparece *no alcanza*.
5. Toca **Registrar transferencia**.

Verás *"Transferencia registrada por $45.000"* con el detalle: ítem, cantidad, costo unitario y costo total. Toca **Ver documento** para abrirla.

## Cómo se valoriza

- Cada ítem sale del origen a su **costo promedio** y entra al destino a ese mismo costo. El promedio del destino se recalcula.
- Los lotes salen del origen por orden de vencimiento (primero lo que vence antes) y llegan al destino con su número y fecha.
- En el kardex quedan dos movimientos: *Transferencia (salida)* en el origen y *Transferencia (entrada)* en el destino.

Solo se transfieren ingredientes y productos con *Stock propio*.

## Errores comunes

- **"El origen y el destino deben ser locales distintos."**: cambia uno de los dos.
- **"Elige el origen y el destino."**: ambos son obligatorios.
- **"Hay un ítem repetido en la transferencia: suma sus cantidades en una sola línea."**
- **"No hay stock suficiente de: …"**: si *Permitir stock negativo* está apagado, el origen no puede quedar bajo cero. Transfiere menos o registra primero la compra.
- **"Necesitas al menos dos locales"**: crea otra sucursal para poder transferir.
