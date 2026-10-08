---
category: configuracion
title: ¿Cómo configuro las comisiones de los medios de pago y veo la plata por llegar?
slug: comisiones-medios-de-pago-y-plata-por-llegar
summary: Ingresa la comisión y los días de abono de débito, crédito, transferencia u otro, y revisa cuánto llega al banco y cuándo.
module: settings
routes: [/settings/payment-methods, /finance/settlements]
tags: [comisiones, medios de pago, transbank, abono, plata por llegar]
position: 1
---

Las comisiones se configuran en **Configuración → Medios de pago**. Con esos datos, **Finanzas → Plata por llegar** estima cuánto recibes y cuándo llega al banco.

## Configurar un medio de pago

1. Entra a **Configuración → Medios de pago**. Verás una tarjeta por medio (Débito, Crédito, Transferencia, Otro). Las que dicen *Sin configurar* aún no tienen datos.
2. Completa:
   - **% comisión**: lo que cobra el banco o la máquina (0 si no cobra).
   - **Monto fijo por transacción**: se cobra por cada pago (0 si no aplica).
   - **+ IVA**: enciéndelo si la comisión lleva IVA.
   - **Días hasta el abono**: cuántos días tarda en llegar la plata (0 = el mismo día, máximo 90).
   - **Solo días hábiles (lunes a viernes)**: enciéndelo si el abono cuenta solo días hábiles.
3. Revisa el ejemplo de la tarjeta: *Cobro de… → comisión…, recibes…*.
4. Toca **Guardar**.

¿Qué valores pongo? Revisa tu contrato o la cartola de tu proveedor de pagos. Como referencia: débito ~1,5 % + IVA con abono en 1 día hábil; crédito ~2,95 % + IVA con abono en 2 días hábiles. La comisión se calcula sobre el monto cobrado con la propina incluida.

El efectivo no tiene comisión ni abono: queda en la caja.

## Ver la plata por llegar

1. Entra a **Finanzas → Plata por llegar** (o toca **Comisiones** para volver a la configuración).
2. Filtra por fechas, medio y local. Sin fechas, ves los últimos 30 días.
3. Revisa las tarjetas **Cobrado (bruto)**, **Comisiones**, **Neto**, **Por llegar** (abono después de hoy) y **Ya abonado**.
4. Más abajo ves el detalle **Por medio de pago** y **Por fecha de abono**.

No incluye efectivo ni pagos anulados. Es una estimación: los días hábiles no consideran feriados y lo que manda es la cartola.

## Errores comunes

- **"Ingresa el porcentaje (0 si no cobra)."** o **"Ingresa el monto (0 si no cobra)."**: el campo no puede quedar vacío.
- **"Debe estar entre 0 y 100."** / **"Máximo 4 decimales."**: corrige el porcentaje.
- **"Debe estar entre 0 y 90."**: los días de abono van de 0 a 90.
- **"Sin pagos con tarjeta ni transferencia"**: no hay cobros con esos medios en el período.
