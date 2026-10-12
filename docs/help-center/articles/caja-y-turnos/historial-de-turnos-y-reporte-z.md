---
category: caja-y-turnos
title: ¿Dónde veo el historial de turnos y el reporte Z?
slug: historial-de-turnos-y-reporte-z
summary: En POS → Turnos de caja ves todos los turnos con sus diferencias y, al entrar a uno, su reporte Z para revisar o imprimir.
module: cash
routes: [/cash, /cash/sessions/:id]
tags: [historial, turnos, reporte z, imprimir, diferencia]
position: 5
---

El historial está en **POS → Turnos de caja**. Ahí ves cada turno con sus ventas y su diferencia, y al tocarlo se abre su reporte Z.

## Ver el historial

1. Entra a **POS → Turnos de caja**.
2. Filtra por local, caja, estado (*Abierta* o *Cerrada*) y fechas **Desde** / **Hasta**. Usa **Limpiar filtros** para volver a ver todo.

Cada fila muestra la caja, quién abrió y cerró, **Ventas**, **Esperado**, **Contado** y **Diferencia** (*Cuadrada*, faltante en rojo o sobrante en verde).

Si tienes dudas sobre los conceptos, abre **¿Cómo funciona la caja?** en la misma pantalla.

## Ver el reporte Z de un turno

Toca un turno para ver:

- **Cabecera**: caja, local, quién abrió y cerró, fondo inicial y notas.
- **Totales**: fondo inicial, ventas, propinas, devoluciones, ingresos y retiros. Si corresponde, también gastos pagados, propinas pagadas y sus anulaciones.
- **Efectivo en caja**: esperado, contado y diferencia.
- **Por medio de pago**: ventas, propinas, devoluciones, esperado, contado y diferencia. En efectivo puedes desplegar **Billetes y monedas**.
- **Movimientos**: hora, tipo, medio, monto, propina, motivo, boleta y usuario.

Toca **Imprimir reporte Z** para imprimirlo.

## Turnos abiertos

Si el turno sigue abierto, verás *"Este turno sigue abierto. Se cierra desde el POS"*. Solo el dueño ve los montos en vivo; el resto ve *"El detalle se ve al cerrar"* (arqueo ciego).

Un turno cerrado no cambia nunca. Si se anula un pago de un turno cerrado, la devolución sale del turno abierto en esa caja.

## Errores comunes

- **"Sin turnos"**: todavía no se ha abierto ninguna caja. Los turnos se abren desde el POS.
- **"No encontramos ese turno"**: el enlace no es válido. Vuelve a **Cajas**.
- **"No se pudo abrir la impresión"**: permite ventanas emergentes en el navegador.
