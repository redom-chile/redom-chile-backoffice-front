---
category: carta-y-productos
title: ¿Cómo creo modificadores (agregados, sin cebolla) y los vinculo a productos?
slug: como-crear-modificadores
summary: Crea un set de modificadores con sus opciones y precios en Carta → Modificadores, y vincúlalo a los productos que lo ofrecen.
module: products
routes: [/products/modifiers]
tags: [modificadores, agregados, extras, opciones, set, vincular productos]
position: 2
---

Los modificadores se crean como **sets** de opciones en **Carta → Modificadores**. Luego vinculas cada set a los productos donde se puede elegir.

## Crear un set

1. Ve a **Carta → Modificadores** y toca **Crear set**.
2. Escribe el **Nombre del set**, por ejemplo *Agregados* o *Punto de la carne*.
3. En **Opciones**, toca **Agregar opción** por cada alternativa y completa:
   - **Nombre**, por ejemplo *Extra queso* o *Sin cebolla*.
   - **Precio ($)**: es el valor con IVA que se suma al producto. Debe ser un número entero. Usa 0 si no tiene costo.
4. Toca **Crear set**.

Por ejemplo: *Agregados*, con *Extra queso* a $800, *Palta* a $1.000 y *Sin cebolla* a $0.

## Vincular el set a productos

Un set sin productos no aparece al tomar pedidos.

1. En la tarjeta del set, toca **Productos**.
2. Busca los productos y márcalos. Los productos marcados aparecen en *Vinculados*. Para quitar uno, toca la **x**.
3. Toca **Guardar**.

La tarjeta muestra cuántos productos tiene vinculados. Desde ese momento, esos productos muestran la etiqueta **Opciones** en el POS.

## Editar o eliminar

- **Editar**: cambia el nombre del set, el nombre o precio de las opciones, o agrega opciones nuevas. Por ahora, las opciones ya guardadas no se pueden eliminar.
- **Eliminar**: borra el set y deja de ofrecerse en los productos vinculados.
- **Recetas**: aparece solo si trabajas con ingredientes y recetas. Sirve para que una opción descuente o sume ingredientes.

## Errores comunes

- **"Agrega al menos una opción"**: el set necesita una opción como mínimo.
- **"Completa el nombre del set y el nombre y precio de cada opción"**: revisa los campos vacíos o los precios inválidos.
- **"Hay opciones con el mismo nombre"**: cada opción del set debe tener un nombre distinto.
- **"Uno o más productos ya no existen…"**: cierra el modal, actualiza la lista y vuelve a vincular los productos.
