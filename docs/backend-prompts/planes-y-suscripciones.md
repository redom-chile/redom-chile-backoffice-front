# Prompt para el backend: Planes, suscripciones y cobros (pago manual y Flow)

> Copiar todo lo que está debajo de la línea y entregarlo al agente / equipo del backend.
> Corresponde a la solicitud #47 de `BACKEND-REQUESTS.md` del front.

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS + TypeORM + Postgres). Repo: `redom-chile-backend`.
Lo relevante:
- Negocio: `restaurant.business` (`owner_id`, `name`, `tax_number_1`, `time_zone`).
- Roles y permisos: `libs/auth` (rol `SUPERADMIN`, `isSuperAdmin()`, tablas `modules`, `permissions`, `roles`).
- Migraciones: `libs/restaurant/database/src/migrations/{schema,seed}` (última: `1758100000000-helpCenter.ts`).
- Ejemplo de guard solo para `SUPERADMIN` y sin negocio: `libs/restaurant/help-center/src/lib/help-admin.guard.ts`.
- Cuota del asistente: `HELP_CHAT_MONTHLY_LIMIT` en `help-assistant.service.ts`; pasa a salir del plan.
- Hay columnas sin uso en `auth.users`: `stripe_id`, `pm_type`, `pm_last_four` y `trial_ends_at`. **No usarlas**: la suscripción
  es del negocio, no del usuario. Eliminarlas en una migración.

Errores con `errorPayload()` y código de negocio en `libs/common/utils/operators/src/lib/error-codes.ts`
(formato `{ statusCode, code, message, details }`). Paginación `page` / `perPage` (máx. 100) → `{ data, pagination }`.

# Objetivo
Redom pasa a cobrarse por planes:
- El **superadmin** administra los planes, sus precios, funciones y límites, los descuentos, los negocios y sus cobros.
- El **dueño** elige un plan (mensual o anual) y lo paga con tarjeta vía **Flow** o por **pago manual** (transferencia).
- Cada negocio accede a las funciones de su plan. El acceso de cada usuario es **plan del negocio ∩ permisos de su rol**:
  el plan filtra al negocio y los permisos a cada persona.
- **Prueba:** 15 días con el plan Pro. El superadmin decide desde el front si exige tarjeta para iniciarla.
- **Todos los pagos quedan registrados** en la base de datos, con su auditoría.

# 1. Protección de datos (Ley 19.628 y Ley 21.719, y PCI DSS)
Es obligatorio y aplica a todo lo de abajo.
- **Nunca** pasan por el backend ni se guardan el número completo de la tarjeta, el CVV ni la fecha de vencimiento.
  - La tarjeta se ingresa **solo en el formulario de Flow** (`customer/register`).
  - De la tarjeta se guarda únicamente lo que Flow devuelve para mostrarla: marca, últimos 4 dígitos y estado del registro.
- **Cifrado a nivel de aplicación (AES-256-GCM)** de los campos sensibles, con IV aleatorio por valor y la clave
  en `BILLING_ENCRYPTION_KEY`. Esa clave vive en el gestor de secretos de AWS, nunca en el repositorio.
  - Columna `key_version` para poder rotar la clave.
  - Implementar un `EncryptedColumnTransformer` reutilizable en `libs/restaurant/database/src/transformers`.
  - Se cifran:
    - el `customerId` de Flow;
    - la marca y los últimos 4 dígitos de la tarjeta;
    - el email y el RUT de facturación;
    - el comprobante y la referencia de los pagos manuales;
    - el cuerpo crudo de los webhooks.
- Además, el cifrado de la base en reposo (RDS) debe estar activo.
- **Minimización y finalidad:** solo los datos necesarios para cobrar y facturar.
- **Logs:** nada sensible en ellos; enmascarar tokens, emails y RUT.
- **Retención:**
  - pagos y comprobantes por el plazo tributario (6 años);
  - al cancelar, se borra el `customerId` de Flow (`customer/delete`) y los datos de la tarjeta, pero se conserva el pago.
- **Acceso:**
  - solo `SUPERADMIN` y el dueño de su propio negocio ven datos de cobro;
  - toda lectura de datos de cobro por un `SUPERADMIN` queda auditada en `billing_events`.
- **Secretos de Flow** (`FLOW_API_KEY`, `FLOW_SECRET_KEY`) solo por variables de entorno o gestor de secretos.
- **Webhooks:** se valida que el `token` corresponda a un pago real consultando a Flow con firma, y se procesan de forma
  idempotente.

# 2. Migración `1758200000000-billing.ts` (schema `restaurant`)

```sql
-- Catálogo de funciones vendibles (la usa el front para el menú y los candados).
CREATE TABLE restaurant.plan_features_catalog (
  code        varchar(40) PRIMARY KEY,          -- pos, cash, inventory, recipes, finance, tips, kitchen_display,
                                                -- printing, bookings, qr_menu, reports, multi_location, help_assistant
  name        varchar(100) NOT NULL,
  description varchar(300),
  module_codes text[] NOT NULL DEFAULT '{}',    -- módulos de auth.modules que habilita (ver sección 5)
  position    int NOT NULL DEFAULT 0
);

CREATE TABLE restaurant.plans (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          varchar(40) UNIQUE NOT NULL,     -- free, emprende, pro, empresa
  name          varchar(100) NOT NULL,
  description   varchar(500),
  is_public     boolean NOT NULL DEFAULT true,   -- false = plan a medida (solo lo asigna el superadmin)
  is_free       boolean NOT NULL DEFAULT false,
  is_highlighted boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  position      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE restaurant.plan_prices (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan_id       int NOT NULL REFERENCES restaurant.plans(id) ON DELETE RESTRICT,
  interval      varchar(10) NOT NULL CHECK (interval IN ('month','year')),
  amount        numeric(12,0) NOT NULL CHECK (amount >= 0),   -- CLP, IVA incluido
  currency      char(3) NOT NULL DEFAULT 'CLP',
  flow_plan_id  varchar(60) UNIQUE,              -- planId creado en Flow (ej. redom-pro-year)
  is_active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Un solo precio vigente por plan e intervalo; los anteriores quedan inactivos (historial).
CREATE UNIQUE INDEX plan_prices_one_active ON restaurant.plan_prices (plan_id, interval) WHERE is_active;

CREATE TABLE restaurant.plan_feature_links (
  plan_id      int REFERENCES restaurant.plans(id) ON DELETE CASCADE,
  feature_code varchar(40) REFERENCES restaurant.plan_features_catalog(code),
  PRIMARY KEY (plan_id, feature_code)
);

CREATE TABLE restaurant.plan_limits (
  plan_id    int REFERENCES restaurant.plans(id) ON DELETE CASCADE,
  limit_code varchar(40) NOT NULL,              -- max_locations, max_users, max_registers, ai_questions_month
  value      int,                               -- NULL = ilimitado
  PRIMARY KEY (plan_id, limit_code)
);

-- Configuración global de la plataforma (la edita el superadmin desde el front).
CREATE TABLE restaurant.platform_settings (
  key        varchar(60) PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
-- Seed: trial_days=15, trial_plan_code='pro', trial_requires_card=false, grace_days=7,
--       fallback_plan_code='free', reminder_days_before=[3,1]

CREATE TABLE restaurant.discounts (
  id               int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code             varchar(40) UNIQUE,           -- cupón que escribe el dueño; NULL = solo lo asigna el superadmin
  name             varchar(100) NOT NULL,        -- "Cliente preferencial", "Lanzamiento 2027"
  type             varchar(10) NOT NULL CHECK (type IN ('percent','amount')),
  value            numeric(12,2) NOT NULL CHECK (value > 0),   -- % (0-100) o CLP
  duration         varchar(10) NOT NULL CHECK (duration IN ('once','repeating','forever')),
  duration_periods int,                          -- con 'repeating'
  plan_ids         int[],                        -- NULL = todos
  intervals        varchar(10)[],                -- NULL = mensual y anual
  business_ids     int[],                        -- NULL = cualquiera; con valores = exclusivo de esos negocios
  max_redemptions  int,
  redemptions      int NOT NULL DEFAULT 0,
  valid_from       timestamptz, valid_until timestamptz,
  flow_coupon_id   varchar(60),
  is_active        boolean NOT NULL DEFAULT true,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE restaurant.subscriptions (
  id                    int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id           int NOT NULL UNIQUE REFERENCES restaurant.business(id),
  plan_id               int NOT NULL REFERENCES restaurant.plans(id),
  price_id              int REFERENCES restaurant.plan_prices(id),     -- NULL en free y en prueba
  status                varchar(15) NOT NULL CHECK (status IN ('trialing','active','past_due','expired','cancelled')),
  billing_method        varchar(10) NOT NULL DEFAULT 'none' CHECK (billing_method IN ('none','flow','manual')),
  trial_ends_at         timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  grace_ends_at         timestamptz,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  scheduled_plan_id     int REFERENCES restaurant.plans(id),           -- bajada de plan al fin del período
  scheduled_price_id    int REFERENCES restaurant.plan_prices(id),
  discount_id           int REFERENCES restaurant.discounts(id),
  discount_periods_left int,
  flow_customer_id_enc  text,                    -- cifrado
  flow_subscription_id  varchar(60),
  card_brand_enc        text,                    -- cifrado
  card_last4_enc        text,                    -- cifrado
  card_registered_at    timestamptz,
  billing_email_enc     text,                    -- cifrado
  billing_tax_id_enc    text,                    -- RUT de facturación, cifrado
  key_version           smallint NOT NULL DEFAULT 1,
  notes                 varchar(1000),           -- nota interna del superadmin
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- Excepciones por negocio (ej. "inventario gratis 2 meses", "+2 locales").
CREATE TABLE restaurant.business_plan_overrides (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id  int NOT NULL REFERENCES restaurant.business(id),
  feature_code varchar(40) REFERENCES restaurant.plan_features_catalog(code),
  limit_code   varchar(40),
  limit_value  int,
  reason       varchar(300) NOT NULL,
  expires_at   timestamptz,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (feature_code IS NOT NULL OR limit_code IS NOT NULL)
);

-- Cobros por período (lo que se debe).
CREATE TABLE restaurant.subscription_invoices (
  id              int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id int NOT NULL REFERENCES restaurant.subscriptions(id),
  business_id     int NOT NULL,
  plan_id int NOT NULL, price_id int NOT NULL,
  period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
  subtotal        numeric(12,0) NOT NULL,
  discount_amount numeric(12,0) NOT NULL DEFAULT 0,
  total           numeric(12,0) NOT NULL,
  due_date        timestamptz NOT NULL,
  status          varchar(10) NOT NULL CHECK (status IN ('pending','paid','overdue','void')),
  paid_at         timestamptz,
  flow_invoice_id varchar(60) UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Registro de TODOS los pagos (Flow y manuales). Inmutable: una anulación es un nuevo registro.
CREATE TABLE restaurant.subscription_payments (
  id               int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id       int NOT NULL REFERENCES restaurant.subscription_invoices(id),
  business_id      int NOT NULL,
  kind             varchar(10) NOT NULL CHECK (kind IN ('payment','refund','reversal')),
  method           varchar(15) NOT NULL CHECK (method IN ('flow_card','flow_other','transfer','cash','other')),
  amount           numeric(12,0) NOT NULL,
  status           varchar(10) NOT NULL CHECK (status IN ('pending','confirmed','rejected')),
  paid_at          timestamptz,
  flow_token       varchar(100) UNIQUE,          -- idempotencia de webhooks
  flow_order       varchar(60),
  reference_enc    text,                         -- N° de transferencia u otra referencia, cifrado
  receipt_file_id  int,                          -- comprobante (archivos ya existentes)
  registered_by    uuid,                         -- superadmin que registró el pago manual
  comment          varchar(500),
  reverses_payment_id int REFERENCES restaurant.subscription_payments(id),
  key_version      smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Webhooks de Flow tal como llegaron (cifrados) y su procesamiento.
CREATE TABLE restaurant.billing_webhook_events (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source       varchar(30) NOT NULL,              -- payment | register | subscription | invoice
  token        varchar(100) NOT NULL,
  payload_enc  text NOT NULL,
  processed_at timestamptz, error varchar(500),
  received_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, token)
);

-- Auditoría: cambios de plan, estados, descuentos, pagos, lecturas de datos de cobro, ajustes de plataforma.
CREATE TABLE restaurant.billing_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id int,
  actor_code  uuid,                               -- usuario; NULL = sistema o webhook
  actor_role  varchar(20),                        -- owner | superadmin | system
  type        varchar(40) NOT NULL,               -- plan_changed, trial_started, payment_confirmed, discount_applied…
  data        jsonb NOT NULL DEFAULT '{}',        -- sin datos sensibles
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Agregar índices por `status` y `current_period_end` en `subscriptions`, y por `status` y `due_date` en `subscription_invoices`.

**Seed:** el catálogo de funciones, los ajustes de plataforma y los planes del borrador (sección 3), con
`plan_prices` en `0` e `is_active=false` hasta que el superadmin ponga los precios.

**Migración de datos:** todos los negocios existentes quedan con su suscripción `trialing` en Pro, con 15 días desde
la migración.

# 3. Borrador de planes (editable por el superadmin)

| | Free | Emprende | Pro | Empresa (privado, a medida) |
|---|---|---|---|---|
| `max_locations` | 1 | 1 | 3 | null |
| `max_users` | 2 | 5 | 15 | null |
| `max_registers` | 1 | 1 | 3 | null |
| `ai_questions_month` | 10 | 50 | 200 | null |
| Funciones | `pos`, `kitchen_display`, `qr_menu`, `help_assistant` | + `cash`, `bookings`, `printing`, `reports` | + `inventory`, `recipes`, `finance`, `tips`, `multi_location` | todas |
| Precio | 0 | mensual y anual a definir | mensual y anual a definir | a medida |

La prueba usa Pro. Las mesas y sectores van dentro de `pos`.

# 4. Ciclo de vida

```
alta del negocio ─► trialing (15 días, plan Pro)
  ├─ con tarjeta (trial_requires_card=true): customer/create → customer/register (formulario de Flow) →
  │     subscription/create con trial_period_days=15 en el plan Flow del precio elegido → Flow cobra solo al terminar
  └─ sin tarjeta: prueba local. Al terminar, si no eligió plan y pagó → baja al plan Free
active ── no pago a tiempo ─► past_due (grace_ends_at = vencimiento + grace_days; banner y correos)
past_due ── paga ─► active
past_due ── vence la gracia ─► expired: queda en el plan Free (fallback_plan_code) sin perder datos
cancelado por el dueño → cancel_at_period_end=true → al terminar el período queda en Free
```

- **Pagos fallidos y vencidos:** se avisa en `past_due` y en la gracia; al terminarla se baja a Free.
- **Subir de plan:** se aplica al tiro. Se cobra la diferencia prorrateada del período actual en un cobro aparte; con
  Flow, se cambia la suscripción.
- **Bajar de plan:** al final del período (`scheduled_plan_id`).
- **Sobre el límite** (por ejemplo, 3 locales en un plan de 1): no se borra nada.
  - Los recursos que sobran quedan en solo lectura, empezando por los más nuevos. No se pueden usar para vender.
  - El dueño elige cuáles quedan activos.
- **Job diario (cron):**
  - pruebas que terminan;
  - `past_due` → `expired`;
  - bajadas programadas;
  - descuentos con `discount_periods_left`;
  - excepciones vencidas;
  - recordatorios por correo (`reminder_days_before`).

# 5. Entitlements (lo que puede usar cada negocio)

`EntitlementsService.get(businessId)` combina el plan efectivo, las excepciones vigentes, los límites, el uso y el
estado. Va en caché por 5 minutos y se invalida al cambiar la suscripción, una excepción o un plan.
- **Caché:** este backend no tiene Redis. Usar caché en memoria del proceso (por ejemplo `@nestjs/cache-manager` en
  memoria) o agregar un Redis propio al `docker-compose` de `redom-chile-backend` en otro puerto, como 6380.
- No usar `localhost:6379`: en la máquina de desarrollo es el Redis de otro proyecto (revom).

- **Plan efectivo:**
  - `trialing` → el plan de prueba;
  - `active` / `past_due` → el de la suscripción;
  - `expired` / `cancelled` → `fallback_plan_code`.
- **`@RequiresFeature('inventory')`** (decorador + guard) en los controladores de cada módulo. Si el plan no la incluye:
  403 `PLAN_FEATURE_NOT_INCLUDED` con `details: { feature, requiredPlans: ['pro', …] }`.
- **Límites:** se validan al crear locales, usuarios y cajas, y en el asistente (reemplaza `HELP_CHAT_MONTHLY_LIMIT`).
  Si se pasa: 409 `PLAN_LIMIT_REACHED` con `details: { limit, max, used, requiredPlans }`.
- **Recursos sobre el límite:** al escribir en ellos, 409 `PLAN_RESOURCE_LOCKED`.
- **`SUPERADMIN`:** no tiene restricciones.
- **Mapa de funciones a módulos** (`module_codes`): documentarlo, para que el front deshabilite en Roles y permisos los
  permisos de módulos que el plan no incluye.

# 6. Endpoints

## 6.1 Públicos (sin sesión): para la landing
- `GET /plans/public` → planes públicos activos, con precios vigentes, funciones (código y nombre) y límites, por `position`.

## 6.2 Negocio (dueño; los demás roles solo leen `entitlements`)
- `GET /billing/entitlements`:
  ```json
  { "plan": { "code", "name" }, "status", "trialEndsAt", "graceEndsAt", "currentPeriodEnd", "cancelAtPeriodEnd",
    "features": ["pos", …], "limits": { "max_locations": 3, … }, "usage": { "max_locations": 1, … },
    "lockedResources": { "locations": [ids] } }
  ```
  También incluirlo dentro de `whoami` como `user.entitlements`.
- `GET /billing/subscription`: suscripción, plan y precio, descuento, tarjeta (marca y últimos 4, descifrados) y
  próximo cobro.
- `GET /billing/plans`: planes públicos con precios, más el plan actual marcado (para comparar).
- `POST /billing/checkout { priceId, couponCode?, method: 'flow'|'manual' }`:
  - **Flow:** crea el cliente si no existe y devuelve `{ redirectUrl }` del registro de tarjeta de Flow. Al volver
    (`url_return`), el backend consulta `customer/getRegisterStatus` y crea o actualiza la suscripción en Flow.
  - **Manual:** crea el cobro `pending` y devuelve los datos para transferir (desde `platform_settings.bank_transfer_info`).
  - Errores:
    - 400 `DISCOUNT_INVALID`, `DISCOUNT_EXPIRED` o `DISCOUNT_NOT_APPLICABLE`;
    - 409 `PLAN_DOWNGRADE_OVER_LIMIT` con `details: { limit, used, max }` si baja a un plan donde no cabe (por ahora se
      bloquea; el dueño debe desactivar primero lo que sobra).
- `POST /billing/card`: actualizar la tarjeta (nuevo registro en Flow) → `{ redirectUrl }`.
- `POST /billing/coupon { code }`: aplica un cupón a la suscripción vigente.
- `POST /billing/cancel` y `POST /billing/resume`: cancelar al fin del período o deshacer la cancelación.
- `GET /billing/invoices?page&perPage`: cobros con sus pagos.
- `POST /billing/invoices/:id/manual-payment { amount, reference, paidAt, receiptFileId }`: el dueño informa su
  transferencia. Queda `pending` hasta que el superadmin la confirma.
- `POST /billing/trial/start`: con `trial_requires_card=true`, inicia el registro de la tarjeta antes de activar la
  prueba. Se usa al terminar el onboarding.

## 6.3 Webhooks de Flow (sin sesión; se valida consultando a Flow)
- `POST /billing/flow/confirmation` (`urlConfirmation` de pagos): recibe `token` → `payment/getStatus` → registra o
  actualiza `subscription_payments` y el cobro.
- `POST /billing/flow/subscription-callback` (`urlCallback` de los planes de Flow): cobros de la suscripción → actualiza
  `subscription_invoices`, `status` y `current_period_*`.
- `GET|POST /billing/flow/return`: vuelta del registro de tarjeta → `customer/getRegisterStatus` → redirige al front
  (`/billing?card=ok|error`).
- Siempre:
  - guardar el evento en `billing_webhook_events` (cuerpo cifrado);
  - procesar de forma idempotente por `(source, token)`;
  - responder 200 rápido.

## 6.4 Superadmin (`/platform/*`, solo `SUPERADMIN`, funciona sin negocio)
- `GET /platform/summary` →
  ```json
  { "businesses": { "total", "trialing", "active", "pastDue", "expired", "free" },
    "trialsEndingThisWeek", "mrr", "arr", "revenueThisMonth", "overdueAmount", "churnLastMonth" }
  ```
- `GET /platform/businesses?search&status&planId&overdue&trialEndingInDays&page&perPage` → negocio, dueño (nombre y
  email), plan, estado, fin del período o de la prueba, saldo vencido y uso.
- `GET /platform/businesses/:id`: detalle con suscripción, uso, cobros, pagos, excepciones y eventos.
- Acciones sobre un negocio (cada una registra un `billing_event` con el actor):
  - `PATCH /platform/businesses/:id/subscription { planId?, priceId?, status?, trialEndsAt?, currentPeriodEnd?, notes? }`
    (cambiar el plan, extender la prueba o el período, reactivar);
  - `POST /platform/businesses/:id/discount { discountId }` y `DELETE /platform/businesses/:id/discount`;
  - `POST /platform/businesses/:id/overrides` y `DELETE /platform/overrides/:id`.
- Planes:
  - `GET /platform/plans` (con inactivos), `POST /platform/plans`, `PUT /platform/plans/:id`, `PATCH /platform/plans/reorder`;
  - `PUT /platform/plans/:id/features { featureCodes }` y `PUT /platform/plans/:id/limits { limits }`;
  - `POST /platform/plans/:id/prices { interval, amount }`: crea el precio vigente, deja inactivo el anterior y crea
    o actualiza el plan en Flow. Las suscripciones vigentes mantienen su precio hasta que el superadmin las migre.
- Catálogo de funciones: `GET /platform/features`.
- Descuentos:
  - `GET|POST /platform/discounts` y `PUT /platform/discounts/:id`;
  - desactivar con `isActive=false`, no borrar si tiene usos;
  - se sincronizan con Flow (`coupon/create`) cuando se usan en suscripciones de Flow.
- Cobros:
  - `GET /platform/invoices?status&businessId&from&to&method&page&perPage`;
  - `POST /platform/invoices/:id/payments { method, amount, paidAt, reference, receiptFileId, comment }`: registrar
    un pago manual. Si la suscripción es de Flow, marcar también el cobro en Flow (`invoice/outsidePayment`);
  - `PATCH /platform/payments/:id/confirm` y `PATCH /platform/payments/:id/reject { reason }`: transferencias que
    informó el dueño;
  - `POST /platform/payments/:id/reverse { reason }`: crea el registro de reverso; nunca se borra.
- Ajustes de la plataforma: `GET /platform/settings` y `PATCH /platform/settings`.
  - `trial_days`, `trial_plan_code`, **`trial_requires_card`**, `grace_days`, `fallback_plan_code`,
    `reminder_days_before`, `bank_transfer_info`.
  - Valores válidos y auditados.
- Exportación: `GET /platform/payments/export?from&to` (CSV) para contabilidad.

# 7. Flow
- API: `https://www.flow.cl/api`; sandbox: `https://sandbox.flow.cl/api`. Base URL por ambiente en `FLOW_API_URL`.
- **Variables de entorno:**
  - `FLOW_API_KEY` y `FLOW_SECRET_KEY`: ya están en el `.env` local. Las claves de sandbox y de producción son distintas.
    En AWS van en el gestor de secretos.
  - `FLOW_API_URL`: en local y desarrollo, el sandbox.
  - `BILLING_PUBLIC_API_URL`: base pública para armar `urlConfirmation`, `urlCallback` y `url_return`. Flow debe poder
    llegar a ella; en local usar un túnel, por ejemplo ngrok.
  - `BILLING_FRONT_URL`: a dónde redirigir al volver del registro de tarjeta.
  - `BILLING_ENCRYPTION_KEY` (32 bytes en base64) y `BILLING_ENCRYPTION_KEY_VERSION`.
  - Si falta alguna, el módulo de cobros no arranca y deja un error claro en el log, sin mostrar valores.
  - **Protección contra cobros reales en desarrollo:** si `NODE_ENV` no es `production` y `FLOW_API_URL` apunta a
    `www.flow.cl`, el módulo no arranca, salvo que se defina `FLOW_ALLOW_PRODUCTION=true`.
  - Las claves de producción solo van en el gestor de secretos del ambiente productivo, nunca en archivos `.env`
    locales ni en `.env.example*`.
- **Sandbox:**
  - cuenta propia en `https://dashboard.sandbox.flow.cl/register/` (el enlace antiguo `sandbox.flow.cl/app/web/register.php`
    ahora redirige al registro de producción); las claves están en Mis datos → Integraciones;
  - datos de prueba en https://developers.flow.cl/docs/credentials:
    - tarjeta Chile `4051885600446623`, vencimiento 11/27, CVV 123;
    - simulación del banco: RUT `11111111-1`, clave `123`;
    - pago recurrente aceptado `5293138086430769` y rechazado `4551708161768059` (son de Perú; confirmar si la de
      Chile sirve para inscribir la tarjeta de una suscripción).
- **Firma:**
  1. ordenar los parámetros por nombre;
  2. concatenar `nombrevalor…`;
  3. aplicar `HMAC-SHA256` con `FLOW_SECRET_KEY`;
  4. enviar el resultado en el parámetro `s` junto con `apiKey`.
- **Endpoints a usar:**
  - clientes: `customer/create` (`externalId` = id del negocio), `customer/register`, `customer/getRegisterStatus`,
    `customer/delete`;
  - planes: `plans/create` y `plans/edit` (uno por precio, con `urlCallback`);
  - suscripciones: `subscription/create` (con `trial_period_days` y `couponId`), `subscription/cancel` y
    `subscription/addCoupon`;
  - cupones: `coupon/create`;
  - cobros: `invoice/get`, `invoice/getOverDue`, `invoice/outsidePayment`;
  - pagos: `payment/getStatus`.
- **Webhooks:** Flow envía un `token` por POST. Nunca se confía en el cuerpo: se consulta el estado con firma.
- Un `FlowClient` aislado (`libs/restaurant/billing/src/lib/flow`), con timeouts, reintentos y logs enmascarados, y
  tests con respuestas simuladas.

# 8. Errores (agregar a `error-codes.ts`)
- `PLAN_FEATURE_NOT_INCLUDED`, `PLAN_LIMIT_REACHED`, `PLAN_RESOURCE_LOCKED`, `PLAN_DOWNGRADE_OVER_LIMIT`;
- `SUBSCRIPTION_NOT_FOUND`, `SUBSCRIPTION_CARD_REQUIRED`;
- `DISCOUNT_INVALID`, `DISCOUNT_EXPIRED`, `DISCOUNT_NOT_APPLICABLE`;
- `PAYMENT_PROVIDER_ERROR` (Flow no respondió), `PAYMENT_ALREADY_CONFIRMED`;
- `PLAN_HAS_SUBSCRIPTIONS` (no se puede desactivar un plan con suscripciones vigentes sin migrarlas).

# Entregables
1. Migración, entidades y seed (catálogo, ajustes, planes del borrador). Eliminar las columnas de cobro de `auth.users`.
2. `EncryptedColumnTransformer` (AES-256-GCM, `key_version`) y su uso en los campos sensibles.
3. `EntitlementsService`, decorador `@RequiresFeature` aplicado a los módulos, validación de límites (incluida la cuota
   del asistente) y entitlements en `whoami`.
4. Endpoints de las secciones 6.1 a 6.4, con el job diario y los correos de recordatorio.
5. `FlowClient`, los webhooks con idempotencia y la sincronización de planes y cupones con Flow (sandbox).
6. Registro de todos los pagos y reversos, y auditoría en `billing_events`.
7. Swagger actualizado (grupos "Billing" y "Platform") y documentación del mapa de funciones a módulos.

# Prueba E2E (sandbox de Flow)
1. Con `trial_requires_card=false`:
   - crear un negocio nuevo → `trialing` en Pro por 15 días;
   - `GET /billing/entitlements` incluye `inventory`.
2. Pasar `trial_ends_at` al pasado y correr el job:
   - sin pago, queda en Free;
   - `GET /inventory/...` → 403 `PLAN_FEATURE_NOT_INCLUDED` con `requiredPlans` que incluye `pro`;
   - crear un segundo local → 409 `PLAN_LIMIT_REACHED`.
3. `PATCH /platform/settings { trial_requires_card: true }`, nuevo negocio:
   - `POST /billing/trial/start` devuelve la URL de Flow;
   - registrar la tarjeta de prueba;
   - la suscripción de Flow queda con 15 días de prueba;
   - en la base solo se guardan la marca y los últimos 4 dígitos, cifrados.
4. Checkout Pro anual con el cupón `LANZAMIENTO` (20 %, una vez):
   - el cobro muestra el descuento;
   - el pago confirmado por webhook deja la suscripción `active`;
   - repetir el webhook no duplica el pago.
5. Pago manual:
   - el dueño informa una transferencia → `pending`;
   - el superadmin la confirma → el cobro queda `paid` y la suscripción `active`;
   - reverso → nuevo registro `reversal`.
6. Cobro vencido:
   - `past_due` con `graceEndsAt`;
   - al vencer la gracia, `expired` en Free, sin perder datos;
   - los locales que sobran quedan en solo lectura.
7. Superadmin:
   - descuento exclusivo para un negocio: otro negocio recibe `DISCOUNT_NOT_APPLICABLE`;
   - extender la prueba 10 días;
   - dar `inventory` por 30 días con una excepción.
8. `GET /platform/summary` refleja los conteos, el MRR y el monto vencido.
9. Un usuario no `SUPERADMIN` → 403 en `/platform/*`.
