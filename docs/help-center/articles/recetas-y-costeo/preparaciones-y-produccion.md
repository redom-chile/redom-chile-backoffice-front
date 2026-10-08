---
category: recetas-y-costeo
title: ¿Qué son las preparaciones y cómo registro una producción?
slug: preparaciones-y-produccion
summary: Una preparación es un ingrediente que elaboras en el local, con receta por tanda y rinde. Al producirla se consumen sus ingredientes y suma su stock.
module: recipes
routes: [/inventory/recipes, /inventory/productions, /inventory/productions/new]
tags: [preparacion, produccion, rinde, tanda, salsa, masa, consumo estimado]
position: 2
---

Una **preparación** es un ingrediente que se elabora en el local (salsas, masas, caldos). Tiene una receta **por tanda** con su **rinde**, y su stock se carga registrando una **producción**.

Solo si tienes activado *Trabajar con ingredientes y recetas* en **Negocio → Mi negocio**, pestaña Inventario.

## Armar la receta de la preparación

1. Crea el ingrediente (ej. "Salsa de tomate") en **Inventario → Ingredientes**.
2. Ve a **Inventario → Recetas**, pestaña **Preparaciones**, y ábrelo.
3. Completa el **Rinde**: cuánto produce una tanda (ej. 2 l).
4. Agrega los ingredientes que consume una tanda, con cantidad y **Merma %**.
5. Toca **Guardar**.

Verás el **Costo de la tanda** y el **Costo por** unidad (costo de la tanda ÷ rinde). Una preparación puede usar otras preparaciones, pero no puede contenerse a sí misma.

Luego agrega la preparación a la receta de tus platos como cualquier ingrediente. Al vender, los platos descuentan la preparación, no sus ingredientes.

## Registrar una producción

1. Ve a **Inventario → Producción** y toca **Nueva producción** (o **Producir** desde la receta).
2. En *Qué vas a producir* elige el **Local**, la **Preparación** y la **Cantidad a producir**.
3. Revisa el **Consumo estimado**: tandas, lo que consume cada ingrediente, el stock en el local y el costo estimado. Si algo no alcanza, verás *No alcanza*.
4. En *Datos de la producción* completa la **Fecha** y, si quieres, **N° de lote**, **Vence** y **Notas**.
5. Toca **Registrar producción**.

Los ingredientes se consumen en proporción: producir 1 l con una receta que rinde 2 l usa media tanda. La preparación entra al stock con el costo de lo consumido. El resumen muestra lo producido, el costo total y el saldo de cada ingrediente.

## Errores comunes

- **"Esta preparación aún no tiene receta."** o **"La receta no indica cuánto rinde una tanda."**: toca **Ir a la receta** y complétala.
- **"No hay stock suficiente en el local de: … Registra una compra o produce menos."**: pasa si *Permitir stock negativo* está apagado.
- **"Hay ingredientes sin costo"**: registra una compra con costo; si no, el costo queda subestimado.
- **"La receta se contendría a sí misma a través de otra preparación."**: quita esa preparación de la receta.
