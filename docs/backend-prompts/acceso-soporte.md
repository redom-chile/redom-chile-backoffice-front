# Prompt para el backend: Acceso de soporte (el dueño autoriza a Redom a gestionar su carta)

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a la solicitud #50 de `BACKEND-REQUESTS.md` del front.

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS). Repo: `redom-chile-backend`. Lo relevante:
- **Principal:** `libs/auth/features/auth-service` (`getPrincipal()`, `principal.restaurantId`, `roleCodes`, `isSuperAdmin()`)
  y `assert-restaurant-scope.helper.ts`.
- **`RestaurantGuard`** (`libs/auth/features/guards/src/lib/restaurant.guard.ts`): rechaza a quien no tiene negocio.
- **Rutas de la carta:**
  - catálogo, en `apps/restaurant/src/app/app.module.ts`: `products`, `categories`, `brands`, `units`, `modifier-sets`,
    `product-modifiers`, `files` (imágenes de productos y categorías);
  - inventario: `inventory/recipes`, más `inventory/food-cost` para consultar.
  - Los ingredientes y las preparaciones son productos.
- **Correos:** plantillas Handlebars en `libs/emails/common/templates`. Son las que usan el cambio de contraseña
  (`emails/reset-password.hbs`) y los avisos de cobro (`emails/billing-notice.hbs`), con el layout común
  `layouts/base.hbs` y `libs/emails/common/services/template.service.ts`. Mira cómo envía
  `libs/emails/features/reset-password-email` y `libs/billing/payments/src/lib/billing-notifications.service.ts`.
- **Auditoría:** similar a `billing_events`.

Errores con `errorPayload()` y código de negocio en `libs/common/utils/operators/src/lib/error-codes.ts`
(formato `{ statusCode, code, message, details }`).

# Objetivo
Un restaurante le pide al equipo de Redom que le arme la carta. Hoy el SUPERADMIN **no gestiona negocios**: no tiene
negocio propio, y el front lo deja solo en Plataforma. Se necesita un **acceso de soporte**:
- **Lo autoriza el dueño** desde su negocio, de forma explícita.
- **Acotado a la carta**, con todo lo relacionado:
  - productos, categorías, subcategorías, marcas, unidades y sus conversiones, modificadores e imágenes;
  - ingredientes, preparaciones y recetas (incluida la merma), más la consulta de food cost.
- **Acotado en el tiempo:** 7 días por defecto, o 1 día, 3 días, 14 días o 30 días.
- **Revocable** por el dueño en cualquier momento.
- **Auditado:** cada cambio queda a nombre de "Soporte Redom (nombre del superadmin)".
- **Con aviso por correo** al dueño cuando autoriza, cuando se usa por primera vez, cuando vence o se revoca, y con un
  resumen de los cambios. Queda como constancia.
- **Fuera del alcance:** ventas, pedidos, pagos, caja, finanzas, propinas, clientes, stock, compras, usuarios ni
  configuración del negocio.

# 1. Migración (schema `restaurant`)
```sql
CREATE TABLE restaurant.support_access_grants (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id   int NOT NULL REFERENCES restaurant.business(id),
  scopes        text[] NOT NULL,                 -- 'catalog' (y a futuro otros alcances)
  granted_by    uuid NOT NULL,                   -- dueño que autorizó
  granted_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  revoked_by    uuid,                            -- dueño o superadmin (el superadmin puede terminarlo antes)
  note          varchar(500),                    -- lo que el dueño le pide a Redom ("cargar la carta de verano")
  first_used_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- Un solo acceso vigente por negocio.
CREATE UNIQUE INDEX support_access_one_active ON restaurant.support_access_grants (business_id)
  WHERE revoked_at IS NULL;

CREATE TABLE restaurant.support_access_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grant_id    int NOT NULL REFERENCES restaurant.support_access_grants(id),
  business_id int NOT NULL,
  actor_code  uuid,                              -- quién (dueño, superadmin o sistema)
  actor_role  varchar(20) NOT NULL,              -- owner | superadmin | system
  type        varchar(40) NOT NULL,              -- granted, extended, revoked, expired, used, entity_created,
                                                 -- entity_updated, entity_deleted
  entity      varchar(40),                       -- product | category | brand | unit | modifier_set | recipe | file
  entity_id   varchar(60),
  summary     varchar(300),                      -- "Creó el producto Lomo a lo pobre"
  data        jsonb NOT NULL DEFAULT '{}',       -- cambios resumidos, sin datos sensibles
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON restaurant.support_access_events (business_id, created_at DESC);
```
- **Vencimiento:** un acceso vencido (`expires_at < now()`) se trata como inactivo. El job diario, o una consulta
  al leer, registra el evento `expired` y envía el correo.

# 2. Cómo entra el superadmin al negocio
- **Header:** el front envía `X-Support-Business-Id: <businessId>` en las llamadas a la API de restaurant mientras el
  superadmin está en "modo soporte".
- **Guard o interceptor de soporte**, antes de `RestaurantGuard`. Si viene el header:
  1. el usuario tiene que ser `SUPERADMIN`; si no, 403 `SUPPORT_ACCESS_FORBIDDEN`;
  2. tiene que existir un acceso vigente para ese negocio; si no, 403 `SUPPORT_ACCESS_NOT_GRANTED`
     (`details: { businessId }`);
  3. la ruta tiene que estar dentro del alcance (lista blanca de controladores, rutas y métodos de `catalog`); si no,
     403 `SUPPORT_ACCESS_OUT_OF_SCOPE` (`details: { scope: 'catalog' }`);
  4. si pasa, el principal de la petición queda con `restaurantId = businessId` y la marca
     `supportGrantId = <id>`, para que los servicios y las consultas filtren por ese negocio sin otros cambios.
- **Sin el header,** todo sigue igual.
- **Lista blanca de `catalog`:**
  - `products`, `categories`, `brands`, `units` (y conversiones): todos los métodos;
  - `modifier-sets`, `product-modifiers`: todos los métodos;
  - `files`: solo carpetas `products` y `categories`;
  - `inventory/recipes`: todos los métodos;
  - `inventory/food-cost`: solo GET;
  - además, GET de `business/:id/settings` y `business-locations` (para leer la configuración, la moneda, el IVA y
    los locales), sin escritura.
- **Uso:** el primer uso de un acceso registra `first_used_at`, el evento `used` y envía el correo "Redom comenzó a
  trabajar en tu carta".
- **Auditoría por cambio:** cada escritura hecha con `supportGrantId` registra en `support_access_events` el tipo,
  la entidad, el id y un resumen legible. Esos cambios no pasan por los permisos de rol del negocio: los cubre el
  alcance.

# 3. Endpoints

## 3.1 Dueño (solo el dueño del negocio; los demás reciben 403 `SUPPORT_ACCESS_OWNER_REQUIRED`)
- **`GET /support-access`** →
  `{ active: Grant | null, history: Grant[] (últimos 10) }`.
  - `Grant` = `{ id, scopes, grantedAt, expiresAt, revokedAt, revokedByName, note, firstUsedAt, grantedByName }`.
- **`POST /support-access`** `{ days: 1|3|7|14|30 (por defecto 7), note? }` → `Grant`.
  - Si ya hay uno vigente, lo reemplaza por el nuevo y registra el evento `extended`.
  - Correo al dueño: "Autorizaste al equipo de Redom a gestionar tu carta hasta {fecha}".
- **`DELETE /support-access`** → 204.
  - Revoca el vigente, con evento `revoked` y el correo "Terminaste el acceso de Redom a tu carta", más el resumen de
    cambios.
- **`GET /support-access/events?grantId&page&perPage`** → paginado de eventos (qué hizo Redom).

## 3.2 Superadmin (`/platform/*` de billing, o en restaurant con `@WithoutRestaurant()` + guard de SUPERADMIN)
- **`GET /platform/support-access?active=true&page&perPage`** → negocios con acceso vigente:
  `{ businessId, businessName, ownerName, expiresAt, note, firstUsedAt }`.
- **En `GET /platform/businesses` y `/platform/businesses/:id`,** agregar `supportAccess: { expiresAt, note } | null`.
- **`DELETE /platform/support-access/:grantId`** → termina el acceso antes (evento `revoked` por superadmin, correo al
  dueño).

## 3.3 Correos (constancia)
- Usar el sistema de plantillas existente: una plantilla nueva `libs/emails/common/templates/emails/support-access.hbs`
  sobre `layouts/base.hbs`, renderizada con `template.service.ts`. Puede ser una sola plantilla con variantes por tipo
  (autorizado, primer uso, terminado), como `billing-notice.hbs`.
- Mismo estilo, logo y pie que los correos actuales. Botón con el link al historial.
- Si el envío falla, no se cae la operación: se registra en el log y en el evento.

| Cuándo | Asunto | Contenido |
|---|---|---|
| El dueño autoriza o extiende | "Autorizaste a Redom a gestionar tu carta" | alcance, hasta cuándo, nota, botón "Ver o revocar acceso" → `{FRONT}/business?tab=soporte` |
| Primer uso | "Redom comenzó a trabajar en tu carta" | quién y cuándo |
| Vence o se revoca | "Terminó el acceso de Redom a tu carta" | resumen de cambios (creados, editados y eliminados por entidad) y link al historial |

# 4. Errores (agregar a `error-codes.ts`)
- `SUPPORT_ACCESS_FORBIDDEN`: el header lo envía alguien que no es SUPERADMIN.
- `SUPPORT_ACCESS_NOT_GRANTED`: sin acceso vigente para ese negocio.
- `SUPPORT_ACCESS_OUT_OF_SCOPE`: ruta fuera del alcance `catalog`.
- `SUPPORT_ACCESS_OWNER_REQUIRED`: solo el dueño autoriza o revoca.

# 5. Seguridad
- **El header solo vale para SUPERADMIN** y siempre se valida contra la tabla: nunca se confía en el front.
- **Sin acceso a datos sensibles:** pedidos, pagos, caja, clientes, finanzas ni usuarios. La lista blanca es cerrada:
  lo que no está, se rechaza.
- **No se puede autorizar a sí mismo:** el superadmin no puede crear accesos.
- **Retención:** los eventos de auditoría se conservan aunque se revoque el acceso.

# Entregables
1. Migración y entidades (`support_access_grants`, `support_access_events`).
2. Guard o interceptor de soporte con la lista blanca `catalog`, `restaurantId` y `supportGrantId` en el principal, y
   auditoría de escrituras.
3. Endpoints del dueño y del superadmin, `supportAccess` en los negocios de plataforma y los correos con la plantilla
   `support-access.hbs` (layout `base.hbs`).
4. Vencimiento (job o consulta) con evento y correo.
5. Swagger actualizado y prompt para el front.

# Prueba E2E
1. El dueño autoriza 7 días con la nota "Cargar la carta" → 201. Llega el correo y `GET /support-access` muestra el
   acceso vigente.
2. El superadmin, con `X-Support-Business-Id`:
   - `GET /products` → 200 con los productos de ese negocio;
   - crear una categoría y un producto con imagen y receta → 201. Se registran los eventos y, la primera vez, el
     correo "Redom comenzó…".
3. Con el mismo header, `GET /orders` o `GET /cash/...` → 403 `SUPPORT_ACCESS_OUT_OF_SCOPE`.
4. Un usuario que no es SUPERADMIN envía el header → 403 `SUPPORT_ACCESS_FORBIDDEN`.
5. El dueño revoca:
   - las llamadas del superadmin → 403 `SUPPORT_ACCESS_NOT_GRANTED`;
   - llega el correo con el resumen de cambios.
6. Un acceso vencido (poner `expires_at` en el pasado) → 403 y evento `expired`, con su correo.
7. `GET /support-access/events` lista lo que hizo Redom ("Creó el producto Lomo a lo pobre").
