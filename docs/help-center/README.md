# Centro de ayuda de Redom: artículos iniciales

Preguntas frecuentes listas para cargar con el CRUD de administración del centro de ayuda
(`docs/backend-prompts/centro-de-ayuda.md`, solicitud #46). Cada archivo es un artículo.

## Formato de cada artículo

`articles/<categoria>/<slug>.md`, con frontmatter que mapea 1:1 a `POST /help/admin/articles`:

```markdown
---
category: caja-y-turnos            # slug de la categoría (tabla de abajo)
title: ¿Cómo cierro la caja?       # la pregunta, 5..200
slug: como-cerrar-la-caja          # único, minúsculas, sin tildes, con guiones
summary: Cierre ciego por billetes y monedas desde el panel del turno.   # 10..300
module: cash                       # onboarding|pos|orders|cash|products|inventory|recipes|finance|tips|settings
routes: [/pos, /cash]              # rutas del front donde aplica
tags: [arqueo, turno, reporte z]   # en minúsculas
position: 3                        # orden dentro de la categoría
---

Respuesta en markdown (el campo `body`).
```

## Reglas de redacción

- Español de Chile, tú, frases cortas. La primera línea responde la pregunta.
- Pasos numerados con la ruta del menú en negrita: **Menú → Pantalla → botón**.
- Solo lo que existe en la app; nada de funciones futuras. Si algo depende de una configuración, decirlo
  ("Solo si tienes activado *Caja y turnos* en Mi negocio → Punto de venta").
- Errores comunes al final, con el mensaje que ve el usuario y cómo resolverlo.
- Sin datos personales ni montos de clientes reales; los ejemplos usan montos redondos en CLP.
- 120 a 450 palabras por artículo.

## Categorías

| Posición | slug | Nombre | Ícono |
|---|---|---|---|
| 0 | `primeros-pasos` | Primeros pasos | `rocket_launch` |
| 1 | `punto-de-venta` | Punto de venta | `point_of_sale` |
| 2 | `pedidos-y-cobros` | Pedidos y cobros | `receipt_long` |
| 3 | `caja-y-turnos` | Caja y turnos | `account_balance_wallet` |
| 4 | `carta-y-productos` | Carta y productos | `restaurant_menu` |
| 5 | `inventario` | Inventario | `inventory_2` |
| 6 | `recetas-y-costeo` | Recetas y costeo | `menu_book` |
| 7 | `finanzas` | Finanzas | `payments` |
| 8 | `propinas` | Propinas | `volunteer_activism` |
| 9 | `configuracion` | Configuración | `settings` |
