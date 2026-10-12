---
category: carta-y-productos
title: ¿Cómo creo un producto y sus categorías?
slug: como-crear-un-producto-y-sus-categorias
summary: Crea categorías y subcategorías en Carta → Categorías, y luego tus productos con precio, imagen y disponibilidad en Carta → Productos.
module: products
routes: [/products, /products/categories]
tags: [producto, categoria, subcategoria, precio, carta, sku, stock]
position: 1
---

Primero crea tus categorías en **Carta → Categorías** y luego crea tus productos en **Carta → Productos** con **Crear producto**.

## Crear una categoría o subcategoría

1. Ve a **Carta → Categorías** y toca **Crear categoría**.
2. Escribe el **Nombre**, que debe tener al menos 2 letras. El *Código corto* (por ejemplo, BEB), la *Descripción* y la *Imagen* son opcionales.
3. Para crear una subcategoría, elige su **Categoría padre**. Si es una categoría principal, deja *Ninguna*.
4. Toca **Crear Categoría**.

En la lista, las subcategorías aparecen indentadas bajo su categoría. En el POS, al tocar una categoría aparecen sus subcategorías.

## Crear un producto

1. Ve a **Carta → Productos** y toca **Crear producto**.
2. Completa los campos obligatorios:
   - **Nombre**, por ejemplo *Hamburguesa clásica*.
   - **SKU**: se sugiere uno según el nombre. Toca el ícono de flechas para sugerir otro.
   - **Precio**: si tus precios incluyen IVA, la etiqueta dice *Precio (IVA incluido)*. Si no, dice *Precio neto (se suma IVA al vender)*.
3. Elige la **Categoría** y, si corresponde, la **Subcategoría**.
4. Opcionalmente, agrega una *Descripción*, una *Imagen del producto* y el *Tiempo de preparación (min)*.
5. Deja activado **Disponible para la venta**. Si lo desactivas, el producto no aparece en el POS ni en la carta.
6. Toca **Crear producto**.

Para editar o eliminar un producto, usa los íconos de lápiz o basurero en su fila. Con el buscador y el filtro de categoría encuentras productos rápidamente.

## Control de stock

El campo **Control de stock** aparece solo si activaste el inventario en **Negocio → Mi negocio → Inventario**. Tiene tres opciones:

- *Sin control*: no descuenta stock.
- *Stock propio*: el producto tiene su propio stock, como una bebida en lata. Puedes indicar la *Unidad de stock* y el *Stock mínimo*.
- *Por receta*: descuenta los ingredientes de la receta. Requiere activar *Trabajar con ingredientes y recetas*.

## Errores comunes

- **"Completa los campos obligatorios"**: falta el nombre, el SKU o el precio.
- **"Ya existe un producto con ese SKU…"**: cambia el SKU o sugiere otro.
- **"Ya existe una categoría con esos datos o tiene elementos asociados."**: usa otro nombre o, si estás eliminando una categoría, revisa qué productos o subcategorías tiene asociados.
