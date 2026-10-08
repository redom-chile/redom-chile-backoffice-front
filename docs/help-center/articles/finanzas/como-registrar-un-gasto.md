---
category: finanzas
title: ¿Cómo registro un gasto?
slug: como-registrar-un-gasto
summary: Registra arriendo, servicios o sueldos con su documento, IVA sugerido, adjunto, vencimiento y, si quieres, el pago al tiro.
module: finance
routes: [/finance/expenses, /finance/expenses/new]
tags: [gasto, factura, iva, adjunto, vencimiento, pagado ahora]
position: 1
---

Los gastos se registran en **Finanzas → Gastos → Nuevo gasto**. Un gasto es toda salida de plata que no es compra de inventario: arriendo, luz, sueldos, publicidad o reparaciones.

## Pasos

1. Entra a **Finanzas → Gastos** y toca **Nuevo gasto**.
2. Completa la **Descripción** (ej: *Cuenta de luz septiembre*), el **Local** y la **Categoría**. Si falta una categoría, toca **Nueva**.
3. Si quieres, elige el **Proveedor** o créalo con **Nuevo proveedor**.
4. Escribe el **Monto total (con IVA)**, por ejemplo $119.000.
5. Elige el **Documento**: *Factura*, *Boleta* o *Sin documento*.
   - Con **Factura**, el campo **IVA (crédito fiscal)** se calcula solo desde el monto (en el ejemplo, $19.000) y ves el **Neto**. Corrígelo si la factura dice otro valor.
   - Con boleta o sin documento, todo el monto es gasto.
6. Si tienes documento, anota el **N° de documento** (opcional).
7. En **Adjunto**, toca **Adjuntar foto o PDF (máx. 10 MB)**. Acepta JPG, PNG, WEBP o PDF.
8. Indica la **Fecha** y, si quieres, el **Vencimiento**. Si lo dejas vacío, se calcula con las condiciones de pago del proveedor (o es el mismo día).
9. Toca **Registrar gasto**.

## Pagado ahora

Si ya pagaste, enciende **Pagado ahora**, elige el **Medio de pago** y, si quieres, una **Referencia** (ej: N° de transferencia). Se registra el pago del total junto con el gasto. Si no lo enciendes, el gasto queda pendiente en **Cuentas por pagar**.

Si pagas en **Efectivo** y usas *Caja y turnos*, el dinero sale de la caja abierta del local.

## Errores comunes

- **"Revisa los campos marcados"**: faltan descripción, local, categoría, monto o fecha.
- **"El IVA no puede ser mayor que el monto"**: corrige el IVA.
- **"El vencimiento no puede ser anterior a la fecha del gasto"**: ajusta las fechas.
- **"Espera a que termine de subir el documento"**: el adjunto aún se está subiendo.
- **"Formato no permitido. Usa JPG, PNG, WEBP o PDF."**: cambia el tipo de archivo.
- **"La caja está cerrada: ábrela para continuar"**: al pagar en efectivo, abre la caja en la ventana que aparece y el gasto se guarda.
