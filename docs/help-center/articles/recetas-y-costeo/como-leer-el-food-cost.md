---
category: recetas-y-costeo
title: ¿Cómo leo el food cost de mis platos?
slug: como-leer-el-food-cost
summary: El food cost muestra qué parte del precio sin IVA se va en costo, por plato y por producto con stock propio, con su margen.
module: recipes
routes: [/inventory/food-cost]
tags: [food cost, costo, margen, rentabilidad, precio, receta]
position: 3
---

En **Inventario → Food cost** ves qué parte del precio sin IVA se va en costo, por cada plato *Por receta* y cada producto con *Stock propio*.

## Cómo se calcula

- **Costo unitario** de cada insumo: su costo promedio ponderado en el local elegido. Con *Promedio del negocio* se promedian los locales según el stock de cada uno.
- **Costo de un plato**: suma de cantidad × (1 + merma %) × costo unitario de cada ingrediente de su receta.
- **Productos con stock propio** (ej. bebidas): su costo es el costo promedio del producto.
- **Food cost %**: costo ÷ precio sin IVA × 100.
- **Margen**: precio sin IVA − costo.

Ejemplo: un plato de $11.900 con IVA vale $10.000 sin IVA. Si su receta cuesta $3.000, su food cost es 30 % y su margen $7.000.

## Cómo leer la pantalla

1. Ve a **Inventario → Food cost**.
2. Elige el local en **Local para calcular los costos**, busca por nombre o SKU y filtra por categoría.
3. Ordena por food cost %, margen o nombre.

Arriba verás **Analizados**, **Food cost promedio** (ponderado por precio) y **Margen promedio** (por unidad, sin IVA). El promedio no incluye platos sin receta ni productos sin precio.

Colores:

- **≤ 30 %**: saludable.
- **30–40 %**: revisar.
- **> 40 %**: alto.

Como referencia, en restaurantes se apunta a un food cost entre 25 % y 35 %.

Desde cada fila puedes abrir **Ver receta** o **Ver kardex**. Toca *Sin receta o costo incompleto* para ver solo los que tienen avisos.

## Por qué un % puede estar mal

- **Costo incompleto**: a un insumo nunca se le registró una compra con costo, así que cuenta como 0 y el % queda subestimado. Registra una compra o un stock inicial con costo.
- **Plato sin ingredientes en su receta**: su costo es 0. Completa la receta.
- **Sin precio**: no se puede calcular el %.

## Errores comunes

- **"Todavía no hay nada que analizar"**: arma recetas para tus platos *Por receta* y registra compras con costo.
- **"El inventario no está activado"**: actívalo en **Negocio → Mi negocio**, pestaña Inventario.
