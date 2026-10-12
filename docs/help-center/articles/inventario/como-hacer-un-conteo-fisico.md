---
category: inventario
title: ¿Cómo hago un conteo físico del inventario?
slug: como-hacer-un-conteo-fisico
summary: Cuenta lo que hay en el local con la planilla de conteo. El stock de cada ítem contado queda igual a lo contado y las diferencias se valorizan.
module: inventory
routes: [/inventory/counts, /inventory/counts/new]
tags: [conteo, toma de inventario, planilla, faltante, sobrante, diferencia]
position: 7
---

Ve a **Inventario → Conteos → Nuevo conteo**, anota lo que contaste en la planilla y toca **Confirmar conteo**. El stock de cada ítem contado queda igual a lo contado; los no contados no cambian.

## Paso a paso

1. Ve a **Inventario → Conteos** y toca **Nuevo conteo**.
2. En *Datos del conteo* elige el **Local**, la **Fecha** y, si quieres, **Notas** (ej. "conteo mensual de bodega").
3. En *Planilla de conteo* aparecen todos los ingredientes y productos con *Stock propio* del local. Puedes:
   - Buscar por nombre o SKU.
   - Filtrar **Todos / Ingredientes / Productos**.
   - Activar **Mostrar stock del sistema** si quieres ver lo que dice Redom (apágalo para un conteo a ciegas).
4. Escribe la cantidad contada de cada ítem en su unidad. Deja vacío lo que no contaste; **0 significa que no queda nada**.
5. Toca **Confirmar conteo (N)** y confirma.

Si hay ventas mientras cuentas, la diferencia se calcula contra el stock al momento de confirmar.

Para cambiar de local después de empezar, toca **vacía lo contado**.

## El resultado

Verás *"Conteo registrado"* con:

- **Diferencia neta valorizada**: valor perdido (faltante neto) o sobrante neto.
- **Líneas con diferencia**: solo estas generan movimientos en el kardex.
- Por cada ítem: Sistema, Contado, Diferencia (*Faltante* o *Sobrante*), Costo unitario y Valor diferencia.

Si todo coincide, verás *"Todo cuadró: lo contado coincide con el stock del sistema."*

Desde ahí puedes ir a **Ver kardex** o **Ver documento**. Las diferencias se valorizan al costo promedio.

Un conteo al final del mes también completa el reporte de **Consumo teórico vs real**.

## Errores comunes

- **"Ingresa la cantidad contada de al menos un ítem."**: la planilla está vacía.
- **"Ingresa un número mayor o igual a 0, con hasta 4 decimales."**: revisa el valor marcado.
- **"'un' no permite decimales."**: esa unidad solo admite enteros.
- **"Un conteo admite hasta N ítems; divídelo en varios conteos."**: haz el conteo por partes (ej. por bodega).
- **"No hay ítems para contar"**: solo se cuentan ingredientes y productos con *Stock propio*.
