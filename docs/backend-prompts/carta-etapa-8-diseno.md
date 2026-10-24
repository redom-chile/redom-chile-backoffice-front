# Prompt para el backend: Diseño de la carta (Etapa 8)

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Requiere las etapas 1 a 7 de la carta pública. Plan completo en el front: `docs/plan-carta-personalizada.md`.
> **Incluye la solicitud #68** (orden manual de categorías y productos, `docs/backend-prompts/orden-categorias-y-productos.md`):
> si ya se implementó, sáltate la Parte B.

---

# Contexto
Trabajas en el BACKEND de REDOM (SaaS para restaurantes; NestJS + TypeORM + PostgreSQL). Repo: `redom-chile-backend`.

Esta etapa permite que cada negocio diseñe su carta sin saber de diseño: plantilla, tipografía, forma de las
tarjetas, íconos y orden de categorías, anuncio, historia del local, recomendaciones del chef, nota del chef por
producto y opciones de accesibilidad.

**Principio SaaS (obligatorio):** el plan solo marca lo máximo que se puede usar. Cada negocio activa, desactiva y
configura cada opción por local. Toda función nueva parte **apagada** o con el valor actual (la carta no debe cambiar
al desplegar), salvo la accesibilidad, que parte encendida.

Lo que ya existe y debes reutilizar:
- `MenuSettingsEntity` (`libs/restaurant/database/src/entities/public-menu.entity.ts`), por local, con `theme`
  (JSON: hoy solo `primaryColor`, `backgroundColor`, `textColor`) y `coverFileId`.
- Personalización: `find-menu-branding` / `update-menu-branding` (`GET|PATCH /menu-settings/{locationId}/branding`), con
  `@RequiresFeature(MENU_BRANDING)` y `@HasPermission(PUBLIC_MENU.MANAGE_SETTINGS)`; la lista blanca de claves está en
  `MenuMarketingService.setBranding`.
- Carta pública: `public-menu.service.ts` (`PublicLocationMenuView`, `branding`, `marketing.mostOrdered`, caché con
  `publicMenu.invalidate(businessId)`).
- Horarios por categoría (`menu_category_schedules`), banners con horario y la lógica `isOpen` / zona horaria.
- Traducciones: `TRANSLATABLE` en `libs/restaurant/public-menu/src/lib/menu-translations.ts`.
- Archivos: `StorageFolder` + `FOLDER_RULES` (`libs/common/storage/src/lib/domain/storage-folder.ts`).
- Funciones de plan: seeds como `1758200080000-populateMenuLanguagesLoyaltyFeatures.ts` y `PlanFeatureCode`.
- Reordenar: patrón de `reorder-help-categories` (`PATCH ... /reorder` con la lista completa de ids).

Errores: `{ statusCode, code?, message, details? }`. Usa `code` en todo error que el front deba explicar.

# Planes y permisos
| Qué | Función del plan | Permiso |
|---|---|---|
| Plantilla, tipografía, tarjetas, íconos de categoría, anuncio, recomendaciones y nota del chef | **nueva** `menu_design` (Emprende, Pro, Empresa) | `public-menu:manage-settings` |
| Historia del local (además de colores y portada, que ya están) | `menu_branding` (Pro, Empresa) | `public-menu:manage-settings` |
| Orden manual de categorías y productos | sin función de plan (todos) | `categories:update-category` / `products:update-product` |
| Accesibilidad (alto contraste, lectura en voz alta) | sin función de plan (todos) | `public-menu:manage-settings` |

- Seed `menu_design` ("Diseño de la carta", "Plantillas, tipografías, íconos, anuncio y recomendaciones del chef")
  en emprende, pro y empresa, agregándolo a `PlanFeatureCode`.
- Sin `menu_design`: los endpoints de escritura responden 403 `PLAN_FEATURE_NOT_INCLUDED` y la carta pública usa los
  valores por defecto (plantilla `classic`), aunque haya datos guardados de antes (por ejemplo, tras bajar de plan).

---

# Parte A: Diseño por local

## Datos
Ampliar `theme` (JSON en `menu_settings`) con estas claves, validadas en la lista blanca:
```ts
template: 'classic' | 'minimal' | 'magazine' | 'chalkboard' | 'grid'        // defecto 'classic'
font: 'modern' | 'classic' | 'elegant' | 'rustic' | 'playful' | 'minimal' | 'bistro'   // defecto 'modern'
cardStyle: 'list' | 'photo' | 'text'                                       // defecto 'list'
categoryStyles: Record<categoryId, 'list' | 'photo' | 'text'>              // opcional, por categoría
accessibility: { highContrast: boolean; readAloud: boolean }               // defecto { true, true }
```
- El backend solo guarda la clave; el front elige las fuentes reales (Google Fonts) y los estilos.
- `categoryStyles`: ignorar ids que no sean del negocio; borrar las de categorías eliminadas al leer.

Nuevas columnas en `menu_settings`:
- `announcement` (JSON, nullable): `{ text: string ≤160, startsAt: timestamptz | null, endsAt: timestamptz | null, isActive: boolean }`.
- `story` (`text`, nullable, ≤1000): "Nuestra historia" del local (función `menu_branding`).

Categorías: nueva columna `icon` (`varchar(40)`, nullable, patrón `^[a-z0-9-]{1,40}$`). La portada ya existe
(`image_file_id`).

## Endpoints
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/menu-settings/{locationId}/design` | | `Design` |
| PATCH | `/menu-settings/{locationId}/design` | parcial de `Design` (sin `updatedAt`) | `Design` |
| GET | `/menu-settings/{locationId}/design/versions` | | `DesignVersion[]` (últimas 10, nuevas primero) |
| POST | `/menu-settings/{locationId}/design/versions/{id}/restore` | | `Design` |
| PATCH | `/menu-settings/{locationId}/branding` (ya existe) | además `story: string \| null` | `Branding` + `story` |
| PATCH | `/categories/{id}` (ya existe) | además `icon: string \| null` | la categoría con `icon` |

```ts
Design = {
  template, font, cardStyle, categoryStyles, accessibility,
  announcement: { text, startsAt, endsAt, isActive } | null,
  updatedAt
}
DesignVersion = { id, design: Design, createdAt, createdBy: { code, name } | null }
```
- **Historial para volver atrás:** cada `PATCH /design` (y cada cambio de `theme`/portada/historia en `branding`) guarda
  la versión anterior en una tabla `menu_design_versions` (`location_id`, `snapshot` JSON, `created_by`, `created_at`);
  conservar las últimas 10 por local. `restore` aplica el snapshot (y guarda la actual como versión).
- Validar enums, largos, que `startsAt < endsAt` y que las fechas sean ISO (400 `MENU_DESIGN_INVALID` con
  `details.field`). Invalidar la caché de la carta en cada cambio.
- `accessibility` se puede cambiar sin `menu_design` (todos los planes); el resto de `PATCH /design`, no.

---

# Parte B: Orden manual de categorías y productos (#68)
Todo lo del prompt `orden-categorias-y-productos.md`, en resumen:
- `position` en `categories` (por padre) y `products` (por categoría); migración que rellena en **orden alfabético**.
- `PATCH /categories/reorder { parentId, ids }` y `PATCH /products/reorder { categoryId, ids }` (lista completa;
  400 `REORDER_IDS_MISMATCH` con `details: { missing, extra }`).
- Productos agrupados como en la carta: la subcategoría si el producto la tiene, si no la categoría.
- Ajuste del negocio `menuSortMode: 'manual' | 'alphabetical'` (defecto `alphabetical`) en el primer nivel de
  `GET/PATCH /business/{id}/settings`; el GET debe devolverlo.
- Los PUT de categoría y producto deben devolver `icon` / `chefNote` en su respuesta (y en `GET /categories/{id}`,
  `GET /products/{id}`), para que el front confirme que se guardaron.
- Lo nuevo queda al final; `GET /categories`, `GET /products`, el POS y la carta pública respetan el modo.

---

# Parte C: Recomendaciones del chef y nota del chef

## Datos
Tabla `menu_chef_picks` (una por local):
```
location_id (PK), business_id, is_active (default false), title varchar(60) default 'Recomendación del chef',
photo_file_id uuid null, product_ids integer[] (orden, máx. 12), schedule jsonb default '[]',
updated_by, updated_at
```
- `schedule`: `[{ dayOfWeek: 0-6, startTime: 'HH:MM', endTime: 'HH:MM' }]`; vacío = siempre. Mismo cálculo de
  horario y zona horaria que los banners (rango que cruza la medianoche incluido).
- Nueva carpeta de archivos `MENU_CHEF` (`menu_chef`, scope business, imágenes, 5 MB), como `MENU_COVERS`.

Productos: nueva columna `chef_note` (`varchar(200)`, nullable).

## Endpoints
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/menu-settings/{locationId}/chef-picks` | | `ChefPicks` |
| PUT | `/menu-settings/{locationId}/chef-picks` | `{ isActive, title, photoFileId, productIds, schedule }` | `ChefPicks` |
| PATCH | `/products/{id}` (ya existe) | además `chefNote: string \| null` | el producto con `chefNote` |

```ts
ChefPicks = { isActive, title, photoFileId, photoUrl, productIds: number[],
              products: [{ id, name, imageUrl, soldOut, hidden }],   // para mostrar el estado en el backoffice
              schedule, updatedAt }
```
- Validar: productos del negocio y a la venta (ni inactivos ni "no se vende"), sin repetidos, máximo 12
  (400 `CHEF_PICKS_INVALID` con `details.reason`: `too_many` | `not_for_sale` | `not_found` | `schedule`).
- `chefNote` se devuelve en `GET /products` y `GET /products/{id}`.
- Requiere `menu_design` (403 sin la función); `chefNote` también.

---

# Parte D: Carta pública
`GET {PUBLIC}/menus/{negocio}/{local}` agrega:
```ts
design: { template, font, cardStyle, categoryStyles, accessibility }     // siempre; por defecto si no hay menu_design
sortMode: 'manual' | 'alphabetical'
announcement: { text } | null          // solo activo, dentro de sus fechas y con menu_design
story: string | null                   // solo con menu_branding
chefPicks: { title, photoUrl, productIds: number[] } | null   // activo, dentro de su horario, con menu_design;
                                                              // solo productos visibles en la carta, en su orden
// en cada categoría y subcategoría: icon, position
// en cada producto: chefNote (null sin menu_design), position
```
- Con `sortMode = 'manual'`, categorías, subcategorías y productos ordenados por `position, name`; si no, por nombre.
- Traducciones (etapa 7): agregar a `TRANSLATABLE`:
  - `product: ['name', 'description', 'chef_note']`;
  - `location: ['description', 'announcement', 'story', 'chef_picks_title']`.
  Que aparezcan en `GET /menu-translations` (marcadas desactualizadas si cambia el original) y en la IA de traducción.
- Invalidar la caché en todos los cambios de esta etapa.

---

# Parte E: Ayuda
Como en etapas anteriores, sumar artículos al Centro de ayuda (seed): "Diseña tu carta" (plantillas, tipografías,
tarjetas, historial), "Ordena tus categorías y productos", "Recomendaciones y nota del chef" y "Accesibilidad de la
carta".

---

# Contrato para el front (resumen)
- `Design`, `DesignVersion`, `ChefPicks` y los campos nuevos de arriba.
- `Category.icon`, `Category.position`, `Product.position`, `Product.chefNote`, `BusinessSettings.menuSortMode`.
- Códigos: `MENU_DESIGN_INVALID`, `REORDER_IDS_MISMATCH`, `CHEF_PICKS_INVALID`, `PLAN_FEATURE_NOT_INCLUDED`.

# Verificación
1. Desplegar: la carta de todos los negocios se ve **igual que antes** (plantilla `classic`, orden alfabético, sin
   anuncio, sin recomendaciones).
2. Negocio Emprende: cambiar plantilla, tipografía y tarjetas → la carta pública trae `design` nuevo; restaurar una
   versión anterior → vuelve.
3. Anuncio con `endsAt` pasado → la carta no lo trae.
4. Recomendaciones con 3 productos y horario de 12:00 a 15:00 → solo aparecen en ese horario; agotar uno → se omite.
5. Nota del chef en un producto → aparece en la carta; traducirla al inglés → `?lang=en` la trae traducida.
6. Negocio Free: `PATCH /design` con plantilla → 403 `PLAN_FEATURE_NOT_INCLUDED`; con solo `accessibility` → 200.
7. Bajar un negocio de Emprende a Free → la carta vuelve a `classic` sin borrar lo guardado.
8. Orden manual (Parte B): ver la verificación de `orden-categorias-y-productos.md`.
