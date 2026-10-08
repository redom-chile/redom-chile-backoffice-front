---
category: recetas-y-costeo
title: ¿Cómo creo la receta de un plato o de una opción de modificador?
slug: como-crear-la-receta-de-un-plato
summary: Indica qué ingredientes consume cada unidad vendida de un plato, con su merma, y qué suma o quita cada opción de modificador.
module: recipes
routes: [/inventory/recipes]
tags: [receta, plato, modificador, merma, quita ingrediente, copiar receta, descontar stock]
position: 1
---

Ve a **Inventario → Recetas**, abre el plato y agrega sus ingredientes con la cantidad que consume **una unidad vendida**. Luego toca **Guardar**.

Solo si tienes activado *Trabajar con ingredientes y recetas* en **Negocio → Mi negocio**, pestaña Inventario. Para que la receta descuente stock al vender, también debe estar activo *Descontar stock al vender*.

## Antes de empezar

Solo los platos con *Control de stock* en **Por receta** usan receta. Cámbialo al editar el producto en **Carta → Productos**.

## Receta de un plato

1. Ve a **Inventario → Recetas**, pestaña **Platos**, y abre el plato. Cada uno muestra *Con receta*, *Sin receta* o *Receta en 1 de 2* (si tiene variaciones).
2. Cada variación (ej. Mediana, Familiar) tiene su propia tarjeta. En **Agregar ingrediente** busca el insumo por nombre.
3. En cada fila completa:
   - **Cantidad** y **Unidad**: si eliges kg y el ingrediente está en g, el sistema convierte.
   - **Merma %**: lo que se pierde al preparar. 150 g de carne con 10 % de merma descuentan 165 g.
4. Toca **Guardar**. Verás *"Receta de … guardada"*. **Descartar cambios** vuelve a lo guardado.

Si el plato tiene varias variaciones, usa **Copiar receta de…** para partir de la receta de otra variación. Revisa y guarda.

Arriba de cada tarjeta ves el **Costo de la receta** y el **% del precio** (food cost). Con **Costos de** eliges el local, o *Promedio del negocio*.

## Receta de una opción de modificador

1. Ve a **Inventario → Recetas**, pestaña **Opciones de modificador**, y abre el set (ej. Agregados).
2. En cada opción agrega lo que consume. Ej: "Extra queso" suma 30 g de queso.
3. Para opciones como "Sin cebolla", agrega la cebolla y marca **Quita ingrediente**: devuelve lo que el plato iba a consumir. El consumo neto nunca baja de 0.
4. Toca **Guardar**.

Los sets se crean en **Carta → Modificadores**.

## Errores comunes

- **"Este producto no usa receta"**: cambia su control de stock a *Por receta*.
- **"Costo incompleto: … no tiene costo"**: falta registrar una compra con costo de ese ingrediente. El costo y el % quedan subestimados.
- **"Hay un ingrediente repetido: suma sus cantidades en una sola fila."**
- **"Entre 0 y 99,99 %."**: corrige la merma.
- **"Solo las opciones de modificador pueden quitar ingredientes (cantidad negativa)."**
- **"Las recetas no están activadas"**: toca **Ir a la configuración**.
