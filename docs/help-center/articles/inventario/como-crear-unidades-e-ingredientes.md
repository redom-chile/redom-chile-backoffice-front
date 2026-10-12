---
category: inventario
title: ¿Cómo creo unidades e ingredientes?
slug: como-crear-unidades-e-ingredientes
summary: Crea las unidades de medida (con sus subunidades) y luego los ingredientes que compras y usas en cocina, con su stock mínimo.
module: inventory
routes: [/inventory/units, /inventory/ingredients]
tags: [unidades, subunidades, ingredientes, insumos, stock minimo, sku]
position: 2
---

Primero crea tus unidades en **Inventario → Unidades** y después tus insumos en **Inventario → Ingredientes**. El stock siempre se guarda en la unidad base (ej. gramos) y puedes comprar o ajustar en sus subunidades (ej. kilos).

## Unidades

1. Ve a **Inventario → Unidades**.
2. Si aún no tienes unidades, toca **Crear unidades sugeridas**: se crean Gramo, Kilogramo, Mililitro, Litro y Unidad. Kilogramo y Litro quedan como subunidades (1 kg = 1000 g; 1 l = 1000 ml).
3. Para otra unidad, toca **Nueva unidad** (o **Crear una a una**) y completa:
   - **Nombre** y **Abreviatura** (ej. Caja, cj).
   - **Permite decimales**: actívalo para kilos o litros; apágalo para lo que se cuenta entero.
   - **Es subunidad de**: elige la unidad base, o *Ninguna* si es una base.
   - **Equivale a**: cuántas unidades base tiene (ej. 1 Caja = 12 Unidad).
4. Toca **Crear unidad**.

Para eliminar una unidad base, primero elimina sus subunidades.

## Ingredientes

Solo si tienes activado *Trabajar con ingredientes y recetas* en **Negocio → Mi negocio**, pestaña Inventario.

Un ingrediente tiene stock pero no se vende ni aparece en la carta ni en el POS (harina, tomate, aceite).

1. Ve a **Inventario → Ingredientes** y toca **Nuevo ingrediente**.
2. Completa:
   - **Nombre**.
   - **SKU**: se sugiere según el nombre; el botón de flechas propone otro.
   - **Unidad**: usa la más chica (ej. gramo). Al comprar podrás usar sus subunidades.
   - **Stock mínimo** (opcional): en la unidad base. Sirve para detectar cuándo reponer.
   - **Categoría** (opcional).
3. Toca **Crear ingrediente**.

Cambiar la unidad de un ingrediente después no convierte el stock ya registrado.

Las bebidas y otros productos que vendes tal cual no son ingredientes: créalos en **Carta → Productos** con *Control de stock* en *Stock propio*.

## Errores comunes

- **"Completa nombre y abreviatura"**: ambos son obligatorios.
- **"Indica a cuánto equivale en la unidad base (mayor a 0)"**: completa *Equivale a* en una subunidad.
- **"Elige la unidad del ingrediente"**: si dice *Aún no tienes unidades*, toca **Crear unidad**.
- **"Los ingredientes no están activados"**: toca **Ir a la configuración** y activa *Trabajar con ingredientes y recetas*.
