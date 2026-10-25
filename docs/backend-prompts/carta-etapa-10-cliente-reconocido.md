# Prompt para el backend: Cliente reconocido (Etapa 10) — por correo

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Requiere las etapas 1 a 9. Plan completo en el front: `docs/plan-carta-personalizada.md` (Etapa 10).
> **Versión 2 (2026-10-24): la identificación es por CORREO.** Reemplaza la versión anterior por WhatsApp (ver "Cambios
> respecto de la versión con WhatsApp" al final). WhatsApp quedará como un canal adicional en una etapa de mensajería.
> Los códigos nuevos van en **camelCase**; los códigos de error, en MAYÚSCULAS como el resto.

---

# Contexto
Trabajas en el BACKEND de REDOM (SaaS para restaurantes; NestJS + TypeORM + PostgreSQL). Repo: `redom-chile-backend`.

Objetivo: que la carta "conozca" al cliente y le facilite volver a pedir:
1. **Identificación liviana por correo** con un código de 6 dígitos (sin contraseña).
2. **Preferencias que se recuerdan** (dieta, alérgenos, idioma) en su perfil, en cualquier local Redom.
3. **"Lo de siempre"**: sus pedidos y productos frecuentes del local, para repetir con un toque.
4. **Su saldo de fidelización** visible en la carta (hoy solo en el seguimiento).
5. **Datos del checkout precargados** (nombre, correo y teléfono si lo dio).

**Por qué correo:** el envío de correos ya está implementado (`ResendEmailUseCase`, `TemplateService`, `EMAIL_FROM`) y no
depende de aprobaciones de Meta. WhatsApp se sumará después como otro canal, sin cambiar el contrato.

**Perfil global:** el cliente tiene **un solo perfil Redom** (correo, nombre, teléfono opcional, preferencias, idioma) que
sirve en todos los negocios. Cada negocio ve **solo** sus pedidos y su fidelización con ese cliente, a través de su
contacto (como hoy).

**Principio SaaS (obligatorio):** cada negocio activa el perfil por local y elige cómo funciona. Todo parte **apagado**.
Los avisos de alérgenos por preferencias guardadas en el navegador **no necesitan backend** (los hace el front, en
todos los planes).

Lo que ya existe y debes reutilizar:
- **Correos:** `ResendEmailUseCase` y `TemplateService` (como `customer-order-notifications.service.ts` y
  `support-access-notifications.service.ts`), `EMAIL_FROM`.
- **Contactos** por negocio (`ContactEntity` con `mobile` y `email`) y `customerContactOf(...)` en
  `customer-contacts.ts`, que crea o encuentra el contacto del negocio al hacer un pedido online.
- **Pedidos:** `customerEmail` ya se guarda en los pedidos online.
- **Fidelización** (etapa 7): saldo por contacto.
- **Límites** por IP de la API pública (`PublicRateLimitGuard`) y Redis.
- **Funciones y límites de plan** (seeds de `billing`), `PlanLimitCode`, `entitlements.plansAbove`.
- **Configuración de la carta** por local (`menu_settings`) y la carta pública (`public-menu.service.ts`).

Errores: `{ statusCode, code?, message, details? }`.

# Planes, límites y permisos
| Qué | Función del plan | Límite | Permiso (backoffice) |
|---|---|---|---|
| Perfil del cliente, "Lo de siempre", saldo en la carta | nueva `customerProfiles` (Emprende, Pro, Empresa) | nuevo `customerOtpMonth` (códigos enviados al mes por negocio, como protección contra abuso): Emprende 1.000, Pro 5.000, Empresa 20.000 | configurar: `public-menu:manage-settings` |
| Avisos de alérgenos con preferencias del navegador | sin función (todos) | — | — |

- Seed `customerProfiles` ("Cliente reconocido en la carta") y el límite `customerOtpMonth`, ajustables desde Plataforma.
  Agregar `customerOtpMonth` a `limits` y `usage` de las entitlements.
- Sin la función: la carta pública devuelve `customerProfiles: null` y los endpoints de cliente para ese negocio
  responden 403 `PLAN_FEATURE_NOT_INCLUDED`.

---

# Parte A: Configuración por local (backoffice)
Ampliar la configuración de la carta del local (`menu_settings`, por ejemplo una columna JSON `customerProfiles`):
```ts
CustomerProfilesSettings = {
  enabled: boolean,                         // defecto false
  mode: 'verified' | 'browserOnly',         // con código por correo, o solo recordar en el navegador
  channel: 'email',                         // por ahora solo correo (WhatsApp vendrá después)
  askPhone: boolean,                        // pedir teléfono (opcional para el cliente; no se verifica)
  showUsual: boolean,                       // mostrar "Lo de siempre"
  showLoyalty: boolean,                     // mostrar el saldo de fidelización
  consentText: string | null,               // ≤ 500; null = el texto de Redom
  privacyUrl: string | null                 // https; política del negocio (además de la de Redom)
}
```
- Se lee y cambia con `GET/PATCH /menu-settings` (como `ordering`), parcial. 400 `MENU_SETTINGS_INVALID` con
  `details.field` si algo no es válido.
- Exponer el texto de consentimiento oficial de Redom para el backoffice: `defaultConsentText` y `consentVersion` en la
  respuesta de `GET /menu-settings`.
- La carta pública (`GET {PUBLIC}/menus/{negocio}/{local}`) agrega `customerProfiles: CustomerProfilesSettings | null`
  (null si está apagado o el plan no lo incluye; `consentText` siempre con el texto final a mostrar). En modo
  `browserOnly`, `askPhone`, `showUsual` y `showLoyalty` no aplican y pueden ir en `false`.

---

# Parte B: Identidad del cliente (API pública)
## Datos
Tabla global `public_customers` (no por negocio):
```
id uuid PK, email (minúsculas, único), name varchar(80) null, phone (E.164) null  -- el teléfono no se verifica
preferences jsonb default '{}'   -- { dietTags: string[], allergenTags: string[], language: 'es'|'en'|'pt'|'de'|null }
consentVersion varchar, consentAt timestamptz, tokenVersion integer default 0,
createdAt, updatedAt, lastSeenAt, deletedAt
```
- `ContactEntity`: nueva columna `publicCustomerId` (uuid null) para unir el contacto del negocio con el perfil.

## Endpoints (`{PUBLIC} = /restaurant/api/public/v1`)
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/customers/otp` | `{ email, businessSlug, locationSlug, language? }` | `{ channel: 'email', expiresIn, resendIn }` |
| POST | `/customers/verify` | `{ email, code, businessSlug, locationSlug, consent: true, name?, phone? }` | `{ token, customer: Customer }` |
| GET | `/customers/me` | | `Customer` |
| PATCH | `/customers/me` | `{ name?, phone?, preferences? }` | `Customer` |
| DELETE | `/customers/me` | | 204 (borra el perfil) |
| POST | `/customers/logout` | | 204 (invalida los tokens: `tokenVersion + 1`) |
| GET | `/customers/me/usual?businessSlug=&locationSlug=` | | `Usual` |
| GET | `/customers/me/loyalty?businessSlug=` | | `{ programName, mechanic, balance } \| null` |

```ts
Customer = { id, email, name, phone, preferences: { dietTags, allergenTags, language }, consentAt, createdAt }
Usual = {
  lastOrders: [{ id, createdAt, channel, total,
                 items: [{ productId, variationId, name, quantity, available: boolean, price /* actual, con IVA */ }] }],  // últimos 3 del local
  favorites: [{ productId, variationId, name, timesOrdered, available: boolean, price }]                                    // hasta 8, más pedidos
}
```
- **Código por correo:** 6 dígitos, guardado **hasheado** en Redis, vence en 10 minutos, máximo 5 intentos (después 429
  `OTP_TOO_MANY_ATTEMPTS`). Correo con una plantilla nueva (`customer-otp`) con el nombre y el logo del negocio, en el
  idioma de la carta (`language`, por defecto `es`): asunto "Tu código para {negocio}: 123456", el código grande y el
  aviso "Si no lo pediste, ignora este correo". Remitente `EMAIL_FROM`.
- **Límites:** por correo 3 envíos cada 10 minutos y 10 al día; por IP, los de la API pública. Cada envío cuenta en
  `customerOtpMonth` del negocio.
- **Errores:** 400 `EMAIL_INVALID`, 400 `OTP_INVALID`, 400 `OTP_EXPIRED`, 429 `OTP_RATE_LIMITED` (`details.retryAt`),
  429 `OTP_QUOTA_EXCEEDED` (el negocio llegó a su límite: el front pasa a modo navegador), 503 `OTP_UNAVAILABLE`
  (falló el envío), 400 `CONSENT_REQUIRED`.
- **Desarrollo:** con `OTP_PROVIDER=log`, no se envía el correo y el código queda en el log; **solo** si
  `NODE_ENV !== 'production'`, la respuesta de `/customers/otp` incluye `devCode`. En producción, `OTP_PROVIDER=email`.
- **Envío detrás de una interfaz** (`OtpSender`) con el canal `email` hoy, para sumar `whatsapp` después sin cambiar el
  contrato (cualquier otro canal → 400 `OTP_CHANNEL_NOT_SUPPORTED`).
- **Token del cliente:** JWT propio (no el del personal), 90 días, con `customerId` y `tokenVersion`, en el header
  **`X-Redom-Customer`** (no `Authorization`). Inválido o vencido: 401 `CUSTOMER_TOKEN_INVALID`.
- **Consentimiento:** `verify` exige `consent: true`; se guarda `consentVersion` y `consentAt`.
- **Borrado (`DELETE /customers/me`):** borra o anonimiza correo, nombre, teléfono y preferencias del perfil y quita
  `publicCustomerId` de los contactos. Los pedidos y la fidelización de cada negocio quedan en su contacto. Registrar el
  borrado.
- **Unión con el negocio:** al verificar, y en cada pedido hecho con `X-Redom-Customer`, buscar el contacto del negocio
  **por correo** (y si no, por teléfono si el perfil lo tiene) o crearlo, y guardar `publicCustomerId`. Ampliar
  `customerContactOf` para buscar también por correo.
- **"Lo de siempre":** pedidos del cliente en ese local (por `publicCustomerId` del contacto o por `customerEmail` del
  pedido), con disponibilidad y precio **actuales** (agotado, oculto, fuera de horario o sin precio → `available: false`).
- **Fidelización:** la del contacto del negocio (la misma de la etapa 7).
- Respetar `customerProfiles` del local: apagado o en `browserOnly` → 409 `CUSTOMER_PROFILES_DISABLED` en `otp`,
  `verify`, `usual` y `loyalty`; `showUsual: false` → `usual` 409; `showLoyalty: false` → `loyalty` 409.

## Pedidos con el cliente identificado
- `POST {PUBLIC}/orders` (mesa, retiro y delivery) acepta el header `X-Redom-Customer`: si es válido, el pedido queda unido
  al contacto del cliente y se guarda su correo. Si el body trae un correo distinto al del perfil: 400
  `CUSTOMER_EMAIL_MISMATCH`.

---

# Parte C: Backoffice
- `GET /customers` (clientes del negocio) y el detalle: agregar `isVerified: boolean` (tiene `publicCustomerId`) y
  `verifiedAt`. El nombre y el teléfono del contacto no se sobrescriben con los del perfil sin que el negocio lo decida.
- Ningún negocio puede leer las preferencias de salud (alérgenos) del perfil global.

# Parte D: Ayuda y privacidad
- Artículos del Centro de ayuda: "Clientes reconocidos en tu carta" (cómo activarlo, modos) y "Privacidad de tus
  clientes".
- Texto de consentimiento de Redom (versión 1) y página de privacidad para clientes (la URL la definen; el front usa
  `https://redom.cl/privacidad` mientras tanto).
- Cumplir la Ley 19.628 y la nueva Ley 21.719: datos mínimos, consentimiento explícito, borrado a pedido.

# Contrato para el front (resumen)
`CustomerProfilesSettings` (en `menu-settings` y en la carta pública), `defaultConsentText`, `Customer`, `Usual`, header
`X-Redom-Customer`, `devCode` (solo fuera de producción), `isVerified` en clientes, `customerOtpMonth` en entitlements;
códigos `EMAIL_INVALID`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `OTP_RATE_LIMITED`, `OTP_QUOTA_EXCEEDED`,
`OTP_UNAVAILABLE`, `OTP_CHANNEL_NOT_SUPPORTED`, `CONSENT_REQUIRED`, `CUSTOMER_TOKEN_INVALID`,
`CUSTOMER_PROFILES_DISABLED`, `CUSTOMER_EMAIL_MISMATCH`, `MENU_SETTINGS_INVALID`, `PLAN_FEATURE_NOT_INCLUDED`.

# Verificación
1. Local sin activar → la carta trae `customerProfiles: null`; `POST /customers/otp` → 409 `CUSTOMER_PROFILES_DISABLED`.
2. Activar en modo `verified` (plan Emprende) → pedir código con `OTP_PROVIDER=log` → la respuesta trae `devCode`; con
   `OTP_PROVIDER=email` llega el correo con el código. `verify` con `consent: true` → token y perfil.
3. Código equivocado 5 veces → 429 `OTP_TOO_MANY_ATTEMPTS`; 4 envíos en 10 minutos → 429 `OTP_RATE_LIMITED`.
4. Hacer dos pedidos identificado → `GET /customers/me/usual` muestra esos productos; agotar uno → `available: false`.
5. Con fidelización activa y el contacto con saldo → `GET /customers/me/loyalty` trae el saldo.
6. Mismo cliente en otro negocio Redom → mismo perfil y preferencias, sin los pedidos del primer negocio.
7. `DELETE /customers/me` → el token deja de servir (401) y el contacto del negocio sigue con sus pedidos.
8. Negocio Free → la carta trae `customerProfiles: null` y los endpoints responden 403.

# Cambios respecto de la versión con WhatsApp
Si ya empezaste con la versión anterior:
- La identidad es el **correo** (único en `public_customers`); el teléfono pasa a ser opcional y no se verifica.
- `POST /customers/otp` y `/verify` reciben `email` en vez de `phone` (y `verify` acepta `phone?` opcional).
- `channel` es `'email'`; las variables y el envío por Meta (`metaWhatsapp`, `WHATSAPP_*`) **no se usan por ahora**
  (pueden quedar detrás de `OtpSender` para después).
- En la configuración, `askEmail` pasa a ser **`askPhone`**.
- Errores: `PHONE_INVALID` → `EMAIL_INVALID`; `CUSTOMER_PHONE_MISMATCH` → `CUSTOMER_EMAIL_MISMATCH`.
- `customerContactOf` busca también por correo.
- Límites `customerOtpMonth` más altos (el correo casi no tiene costo): Emprende 1.000, Pro 5.000, Empresa 20.000.
