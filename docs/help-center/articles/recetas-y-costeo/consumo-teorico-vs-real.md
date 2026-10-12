---
category: recetas-y-costeo
title: ¿Cómo leo el reporte de consumo teórico vs real?
slug: consumo-teorico-vs-real
summary: Compara lo que las ventas debieron consumir según las recetas con lo que realmente salió del stock, para detectar pérdidas.
module: recipes
routes: [/inventory/consumption]
tags: [consumo teorico, consumo real, variacion, perdidas, mermas, conteo]
position: 4
---

En **Inventario → Consumo** comparas lo que las ventas debieron consumir según las recetas con lo que realmente salió del stock en un local y un período.

## Cómo usarlo

1. Ve a **Inventario → Consumo**.
2. Elige el **local**.
3. Elige el período: **Este mes**, **Mes anterior**, **Últimos 7 días** o **Personalizado** (con *Desde* y *Hasta*).
4. Si quieres, usa **Filtrar por ítem…** para ver un solo ingrediente o producto.

## Qué significa cada número

- **Consumo teórico**: lo que las ventas debieron consumir según las recetas (y los productos con stock propio vendidos).
- **Mermas**: pérdidas registradas como ajuste.
- **Faltantes del conteo**: lo que faltó al contar.
- **Consumo real**: teórico + mermas + faltantes del conteo.
- **Variación** (real − teórico): lo que se perdió por mermas, robos o porciones mal servidas. En rojo si es pérdida; si es negativa, el conteo encontró más stock del esperado.

Los valores usan el costo promedio del local y las cantidades se muestran en la unidad base de cada ítem.

## La tabla por ítem

Por cada ingrediente o producto ves: Inicial, Compras, Transferencias, Ajustes, Mermas, Dif. conteo, Consumo teórico, Consumo real, Variación y Final. En el detalle también aparecen lo *Producido* y lo *Usado en producción*. Puedes ordenar la tabla y abrir el kardex de cada ítem.

## Ejemplo

Vendiste 100 hamburguesas con 150 g de carne cada una: el consumo teórico es 15 kg. Registraste 1 kg de merma y el conteo de fin de mes encontró 2 kg menos de lo esperado. El consumo real es 18 kg y la variación es 3 kg.

## Para que el reporte sirva

- Tus platos deben tener receta y *Descontar stock al vender* debe estar activo.
- Haz un **conteo físico al final del período** en **Inventario → Conteos**. Sin conteo, la variación solo refleja las mermas registradas. Si no hay conteos, verás el aviso *No hay conteos en el período* con el botón **Hacer un conteo**.
- El período usa la fecha en que se registró cada movimiento, no la fecha del documento.

## Errores comunes

- **"La fecha 'Desde' no puede ser posterior a 'Hasta'."**: corrige el período.
- **"Sin movimientos en el período"**: no hubo ventas, compras, ajustes ni conteos en ese local entre esas fechas. Prueba con otro período o local.
- **"Aún no tienes locales"**: crea uno en **Negocio → Sucursales**.
