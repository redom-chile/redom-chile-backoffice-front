---
category: inventario
title: ¿Cómo hago un ajuste de stock (merma, stock inicial o corrección)?
slug: como-hacer-un-ajuste-de-stock
summary: Registra mermas, consumo interno, stock inicial o correcciones desde Inventario, Ajustes, eligiendo el motivo del ajuste.
module: inventory
routes: [/inventory/adjustments, /inventory/adjustments/new]
tags: [ajuste, merma, stock inicial, consumo interno, correccion, perdida]
position: 5
---

Ve a **Inventario → Ajustes → Nuevo ajuste**, elige el motivo, el local y los ítems, y toca **Registrar ajuste**. El motivo define si las cantidades suman o restan.

## Motivos

- **Merma** (resta): vencido, dañado o se cayó. La nota es obligatoria.
- **Consumo interno** (resta): comida del personal o degustación.
- **Stock inicial** (suma): lo que tienes al empezar a usar el inventario. El costo es opcional y fija el costo promedio.
- **Corrección por conteo** (+ / −): después de contar, usa + para sumar y − para restar la diferencia.
- **Otro** (+ / −): explica el motivo en la nota (obligatoria).

## Paso a paso

1. Ve a **Inventario → Ajustes** y toca **Nuevo ajuste** (también está en **Inventario → Stock**).
2. Elige el **Motivo**.
3. En *Datos del ajuste* elige el **Local**, la **Fecha** y escribe las **Notas** (ej. "se venció el lote del lunes").
4. En *Ítems* busca cada ítem y escribe la cantidad:
   - Motivos que restan o suman: ingresa la cantidad en positivo.
   - Motivos + / −: ingresa la diferencia con signo (ej. −3 si faltan 3). El botón ± cambia el signo.
5. En las líneas que suman puedes indicar costo unitario, lote y vencimiento (opcionales).
6. Toca **Registrar ajuste**. Verás *"Ajuste registrado"*.

Las salidas descuentan primero lo que vence antes, incluidos los lotes vencidos.

## Stock inicial

Al activar el inventario, usa el atajo **Carga tu stock inicial** o elige el motivo *Stock inicial*. Indica el costo unitario para que el costo promedio y el food cost partan correctos.

Si haces un conteo completo, prefiere **Inventario → Conteos**: calcula la diferencia por ti.

## Errores comunes

- **"Para 'Merma' explica el motivo en la nota."**: la nota es obligatoria en Merma y Otro.
- **"Las cantidades no pueden ser 0."**: quita la línea o cambia la cantidad.
- **"Para este motivo ingresa la cantidad en positivo."**: en Merma, Consumo interno y Stock inicial no uses signo.
- **"No hay stock suficiente de: …"**: si *Permitir stock negativo* está apagado, una salida no puede dejar el stock bajo cero. Revisa la cantidad o actívalo en **Negocio → Mi negocio**, pestaña Inventario.
- **"Estos productos no tienen stock propio: …"**: cambia su *Control de stock* a *Stock propio* en **Carta → Productos**.
