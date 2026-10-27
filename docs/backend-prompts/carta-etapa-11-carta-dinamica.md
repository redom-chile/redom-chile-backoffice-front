# Prompt para el backend: Carta dinámica (Etapa 11)

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Requiere las etapas 1 a 10. Plan completo en el front: `docs/plan-carta-personalizada.md` (Etapa 11).
> Los códigos nuevos van en **camelCase** (funciones de plan, valores de enums, campos y tipos de evento); los códigos
> de error, en MAYÚSCULAS como el resto.

---

# Contexto
Trabajas en el BACKEND de REDOM (SaaS para restaurantes; NestJS + TypeORM + PostgreSQL). Repo: `redom-chile-backend`.

Objetivo: que la carta muestre **lo correcto en el momento correcto**:
1. **Momentos** del día (desayuno, almuerzo, once, happy hour…): cada uno destaca o muestra solo ciertas categorías y
   productos en su horario, y la carta cambia sola.
2. **Temporadas y fechas** (Fiestas Patrias, Navidad, verano): destacados que se activan solos entre dos fechas.
3. **Reglas por clima** (opcional): destacar sopas si llueve o bebidas frías con calor.
4. **Plato del día** con porciones y cuenta regresiva ("Quedan 5", "Hasta las 15:00").
5. **"Completa tu pedido"**: sugerencias en el carrito (manuales del dueño y automáticas por ventas conjuntas).

**Principio SaaS (obligatorio):** todo parte **apagado** y cada negocio lo configura por local. Al desplegar, ninguna
carta cambia.

Lo que ya existe y debes reutilizar:
- Horarios por categoría (`category_schedules`) y el cálculo de horario con la zona horaria del negocio (`isOpen`, rangos
  que cruzan la medianoche).
- Banners con fechas y horario (`menu_banners`), promociones (`menu_promotions`), "Los más pedidos" (`mostOrdered`).
- Coordenadas del local (`menu_settings.latitude/longitude`).
- Disponibilidad por local (`product_location_availability`: agotado y oculto) y la carta pública (`public-menu.service.ts`)
  con su caché (`publicMenu.invalidate`).
- Analítica de la carta (`POST {PUBLIC}/menus/.../events`, tipos `product_view`, `add_to_cart`, …).
- Pedidos (mesa, retiro y delivery) y ventas del POS.
- Funciones de plan (seeds de `billing`), `PlanFeatureCode`.

Errores: `{ statusCode, code?, message, details? }`.

# Planes y permisos
| Qué | Función del plan | Permiso |
|---|---|---|
| Momentos, temporadas y sugerencias manuales | nueva `menuDynamic` (Emprende, Pro, Empresa) | ver `public-menu:see-module`; configurar `public-menu:manage-marketing` |
| Clima, plato del día y sugerencias automáticas | nueva `menuDynamicPlus` (Pro, Empresa) | `public-menu:manage-marketing` |

- Sin la función: 403 `PLAN_FEATURE_NOT_INCLUDED` (`details.requiredPlans`) y la carta pública no aplica esas reglas
  (aunque haya datos guardados de antes).

---

# Parte A: Momentos del día
Tabla `menu_moments` (por local):
```
id, businessId, locationId, name (≤40, "Almuerzo"), icon (≤40, opcional, catálogo de íconos de la carta),
days smallint[] (0 = domingo … 6), startTime 'HH:MM', endTime 'HH:MM' (puede cruzar la medianoche),
mode ('highlight' | 'only'),     -- destacar arriba o mostrar solo lo del momento
categoryIds integer[], productIds integer[], position, isActive (default true), createdAt, updatedAt
```
| Método | Ruta | Body |
|---|---|---|
| GET | `/menu-dynamic/moments?locationId=` | |
| POST | `/menu-dynamic/moments` | `{ locationId, name, icon?, days, startTime, endTime, mode, categoryIds?, productIds?, isActive? }` |
| PATCH | `/menu-dynamic/moments/{id}` | parcial |
| DELETE | `/menu-dynamic/moments/{id}` | 204 |
| PATCH | `/menu-dynamic/moments/reorder` | `{ locationId, ids }` |

- Validar: al menos una categoría o producto del negocio; horario válido; dos momentos activos del mismo local no se
  pueden superponer (400 `MENU_MOMENT_OVERLAP` con `details.momentId`). 400 `MENU_DYNAMIC_INVALID` con `details.field`.
- `mode: 'only'` oculta en la carta lo que no está en el momento **solo mientras está vigente**; fuera de él, la carta
  completa.

# Parte B: Temporadas y fechas
Tabla `menu_seasons` (por local o todos los locales del negocio con `locationId` null):
```
id, businessId, locationId null, name (≤60, "Fiestas Patrias"), startsAt, endsAt (timestamptz),
title (≤60, opcional, se muestra como sección), productIds integer[], bannerId (opcional: activa ese banner),
isActive, createdAt, updatedAt
```
Endpoints `GET/POST/PATCH/DELETE /menu-dynamic/seasons` (como los momentos). 400 si `startsAt >= endsAt`.

# Parte C: Reglas por clima (`menuDynamicPlus`)
Configuración por local en `menu_settings.dynamic` (JSON):
```ts
weather: {
  enabled: boolean,                      // defecto false; requiere latitude/longitude del local (si no, 400 MENU_WEATHER_NO_LOCATION)
  rain: { title: string, productIds: number[], categoryIds: number[] } | null,   // "Para la lluvia"
  hot:  { minTempC: number, title: string, productIds: number[], categoryIds: number[] } | null,   // "Para el calor" (defecto 26 °C)
  cold: { maxTempC: number, title: string, productIds: number[], categoryIds: number[] } | null    // "Para el frío" (defecto 10 °C)
}
```
- Clima actual del local desde **Open-Meteo** (sin clave): `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,precipitation,weather_code`.
  Guardar en caché por coordenadas redondeadas 30 minutos (Redis). Si falla, no se aplica la regla (nunca rompe la carta).
- `GET/PATCH /menu-settings/{locationId}/dynamic` (parcial). Sin `menuDynamicPlus`: 403.

# Parte D: Plato del día (`menuDynamicPlus`)
Tabla `menu_daily_specials` (por local):
```
id, businessId, locationId, productId, variationId (opcional), title (≤60, "Plato del día"), note (≤160, opcional),
price (opcional, con IVA; null = el de la carta), portions (null = sin límite), portionsSold integer default 0,
startsAt, endsAt (timestamptz), isActive, createdAt, updatedAt
```
| Método | Ruta | Body |
|---|---|---|
| GET | `/menu-dynamic/daily-specials?locationId=&from=&to=` | |
| POST | `/menu-dynamic/daily-specials` | `{ locationId, productId, variationId?, title?, note?, price?, portions?, startsAt, endsAt }` |
| PATCH | `/menu-dynamic/daily-specials/{id}` | parcial (incluye `portions` para reponer) |
| DELETE | `/menu-dynamic/daily-specials/{id}` | 204 |

- Un solo plato del día vigente por local a la vez (400 `MENU_DAILY_SPECIAL_OVERLAP`).
- **Porciones:** cada venta del producto (pedido de la carta aceptado o venta del POS) suma `portionsSold`; al llegar a
  `portions`, el plato se muestra "Agotado" y la carta no deja agregarlo (409 `PRODUCT_UNAVAILABLE` con
  `reason: 'dailySpecialSoldOut'`). Si el pedido se rechaza o la venta se anula, se devuelve la porción.
- Con `price`, ese precio se usa en la carta y en el pedido mientras esté vigente (como una promoción; no se suma a otra
  promoción: se usa el menor).

# Parte E: "Completa tu pedido"
## Reglas manuales (`menuDynamic`)
Tabla `menu_suggestion_rules` (por local o todos):
```
id, businessId, locationId null, name (≤60), triggerProductIds integer[], triggerCategoryIds integer[],
suggestProductIds integer[] (≤6, en orden), message (≤80, "¿Lo acompañas con papas?"), position, isActive
```
Endpoints `GET/POST/PATCH/DELETE /menu-dynamic/suggestion-rules` y `PATCH .../reorder`.

## Automáticas (`menuDynamicPlus`)
- Productos que más se piden juntos en los últimos 90 días (pedidos de la carta y ventas del POS del local), calculados
  por un job diario. Configuración en `menu_settings.dynamic.suggestions`:
  `{ mode: 'manual' | 'automatic' | 'both' (defecto 'manual'), excludeProductIds: number[], maxItems: 1..6 (defecto 3) }`.

## Endpoint público
`POST {PUBLIC}/menus/{negocio}/{local}/suggestions` `{ items: [{ productId, variationId }] }` →
`{ suggestions: [{ productId, reason: 'rule' | 'frequentlyTogether', message: string | null }] }` (hasta `maxItems`,
solo productos disponibles ahora, sin los que ya están en el carrito ni los excluidos). Con el local sin la función o
sin reglas: `{ suggestions: [] }`.

# Parte F: Carta pública
`GET {PUBLIC}/menus/{negocio}/{local}` agrega (todo ya resuelto **para este momento**, con la zona horaria del negocio):
```ts
dynamic: null | {
  moment: { id, name, icon, mode: 'highlight' | 'only', categoryIds, productIds, endsAt } | null,
  upcomingMoments: [{ id, name, icon, startsAt }],                     // próximos 2 de hoy, para mostrar "Desde las 12:00: Almuerzo"
  season: { id, name, title, productIds, endsAt } | null,
  weather: { condition: 'rain' | 'hot' | 'cold', title, productIds, categoryIds, temperatureC } | null,
  dailySpecial: { id, productId, variationId, title, note, price, portionsLeft: number | null, endsAt, soldOut: boolean } | null,
  suggestionsEnabled: boolean
}
```
- `null` si el local no tiene nada activo o el plan no lo incluye.
- Con `moment.mode: 'only'`, las categorías y productos fuera del momento **no vienen** en la carta durante el momento
  (y los pedidos de esos productos responden 409 `PRODUCT_UNAVAILABLE` con `reason: 'outOfMoment'`).
- La caché de la carta debe considerar los cambios de momento (expirar al inicio y fin de cada momento) y el clima (30 min).
- Eventos nuevos de analítica: `suggestionShown`, `suggestionAccepted`, `dailySpecialView` (además de los existentes).

# Parte G: Ayuda
Artículos: "Momentos del día en tu carta", "Temporadas y fechas especiales", "Plato del día" y "Sugerencias en el carrito".

# Aclaraciones para el front (v2)
1. **Precio del plato del día en la carta:** mientras esté vigente, aplicar `price` en el producto de la carta pública
   como se hace con las promociones (`variations[].price` con el especial y `originalPrice` con el normal), para que el
   detalle, el carrito y el pedido muestren el mismo monto.
2. **Fechas:** `moment.endsAt`, `upcomingMoments[].startsAt`, `season.endsAt` y `dailySpecial.endsAt` en ISO con
   zona (no "HH:MM").
3. **Listas por local:** `GET /menu-dynamic/seasons?locationId=` y `GET /menu-dynamic/suggestion-rules?locationId=`
   deben devolver también los registros de **todos los locales** (`locationId: null`). En
   `GET /menu-dynamic/daily-specials`, `from` y `to` filtran por `startsAt` (desde el inicio de `from` hasta el fin de
   `to`; sin `to`, todo lo que viene). En los ajustes de clima, `details.field` con la ruta completa
   (`weather.hot.minTempC`).
4. **Analítica:** aceptar los tipos de evento `suggestionShown`, `suggestionAccepted` y `dailySpecialView` en
   `POST {PUBLIC}/menus/.../events` (con `refId` = producto o plato del día).

# Contrato para el front (resumen)
Tablas y endpoints de arriba (`/menu-dynamic/*`, `/menu-settings/{id}/dynamic`, `.../suggestions`), `dynamic` en la
carta pública; códigos `MENU_DYNAMIC_INVALID` (`details.field`), `MENU_MOMENT_OVERLAP`, `MENU_DAILY_SPECIAL_OVERLAP`,
`MENU_WEATHER_NO_LOCATION`, `PRODUCT_UNAVAILABLE` (`reason`: `dailySpecialSoldOut` | `outOfMoment`),
`PLAN_FEATURE_NOT_INCLUDED`.

# Verificación
1. Sin configurar nada → la carta trae `dynamic: null` y se ve igual que antes.
2. Momento "Almuerzo" 12:00–15:30 lunes a viernes, modo `highlight` → a las 13:00 de un martes la carta trae `moment` y
   `upcomingMoments` vacío o con el siguiente; a las 16:00, `moment: null`.
3. Modo `only` → durante el momento solo vienen sus categorías; pedir un producto de fuera → 409 `outOfMoment`.
4. Temporada del 15 al 20 de septiembre → `season` solo en esas fechas.
5. Clima: con lluvia en las coordenadas del local (o simulando la respuesta de Open-Meteo) → `weather.condition: 'rain'`.
6. Plato del día con 3 porciones → vender 3 → `soldOut: true` y 409 al pedirlo; anular una venta → `portionsLeft: 1`.
7. Regla "con hamburguesa, sugerir papas" → `suggestions` con las papas y su mensaje; agregar las papas al carrito → ya
   no se sugieren.
8. Plan Emprende → momentos y reglas manuales sí; clima, plato del día y automáticas → 403.
