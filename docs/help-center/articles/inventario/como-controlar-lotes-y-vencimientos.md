---
category: inventario
title: ¿Cómo controlo lotes y vencimientos?
slug: como-controlar-lotes-y-vencimientos
summary: Anota lote y vencimiento al comprar o producir, revisa lo que está por vencer en Inventario, Lotes, y registra la merma de lo vencido.
module: inventory
routes: [/inventory/lots, /inventory]
tags: [lotes, vencimiento, fefo, por vencer, vencidos, merma]
position: 9
---

Anota el lote y la fecha de vencimiento al registrar una compra, un stock inicial o una producción. Después revisa en **Inventario → Lotes** lo que está por vencer o vencido.

## Anotar el lote

En cada línea de una compra o de un ajuste que suma stock, toca **Lote / vencimiento** y completa:

- **Lote (opcional)**: ej. L2410.
- **Vence (opcional)**: la fecha de vencimiento.

En una recepción de orden de compra están los campos **Lote** y **Vencimiento**, y en una producción, **N° de lote** y **Vence**.

## Cómo se descuenta (FEFO)

Las salidas (ventas, mermas, transferencias y producciones) descuentan primero los lotes vencidos y luego los que vencen antes.

## Pantalla de lotes

1. Ve a **Inventario → Lotes**.
2. Elige el estado: **Activos**, **Por vencer** o **Vencidos**.
3. Ajusta **Por vencer en** (3, 7, 15 o 30 días) y el local.

Por cada lote ves: Ítem, Lote, Vence, Estado (*Vigente*, *Por vencer*, *Vencido* o *Sin vencimiento*), cantidad Inicial / Actual, Costo, Valor y Local. Solo aparecen los lotes con saldo.

El costo de cada lote es solo una referencia: el stock y los consumos se valorizan al costo promedio del ítem en el local.

## Avisos en el stock

En **Inventario → Stock** verás el aviso *Por vencer / Vencidos* con dos números: ítems con lotes que vencen en los próximos días y ítems con lotes ya vencidos que aún tienen stock. Toca **Ver por vencer** o **Ver vencidos**.

## Registrar la merma de lo vencido

En un lote vencido toca **Registrar merma**. Se abre un ajuste con motivo *Merma* ya cargado; escribe la nota y toca **Registrar ajuste**. Como las salidas consumen primero lo vencido, la merma descuenta esos lotes.

## Errores comunes

- **"Esta fecha ya pasó: el lote quedará como vencido."**: revisa la fecha antes de guardar.
- **"La fecha de vencimiento no es válida."**: corrige la fecha.
- **"El lote y el vencimiento solo se indican en líneas que suman stock"**: en salidas no se elige lote; se usa primero lo que vence antes.
- **"Aún no hay lotes con saldo"**: anota lote y vencimiento en tu próxima compra o stock inicial.
