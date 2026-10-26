# Prompt para el backend: Mensajería y panel de clientes (Etapa 10.2)

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Requiere las etapas 1 a 11 y el módulo legal global (#77). Plan en el front: `docs/plan-carta-personalizada.md`
> (Etapa 10.2). **Canal: correo.** WhatsApp se sumará después como otro canal, sin cambiar el contrato.
> Los códigos nuevos van en **camelCase**; los códigos de error, en MAYÚSCULAS como el resto.

---

# Contexto
Trabajas en el BACKEND de REDOM (SaaS para restaurantes; NestJS + TypeORM + PostgreSQL). Repo: `redom-chile-backend`.

Objetivo: que cada negocio conozca a sus clientes y los haga volver, **siempre con su permiso**:
1. **Panel de clientes**: segmentos (nuevos, frecuentes, en riesgo, perdidos, VIP) con visitas, gasto y última visita.
2. **Mensajes automáticos por correo**: encuesta después de la visita, avisos de fidelización y "te extrañamos".
3. **Campañas por correo** a un segmento, **solo a quienes aceptaron recibir novedades** del negocio (`marketingConsent`
   del módulo legal).
4. **Darse de baja** con un clic en cada correo, y registro de envíos, rebotes y reclamos.

**Principio SaaS (obligatorio):** todo parte **apagado**; cada negocio activa cada mensaje, edita su texto y elige a quién.
**Cumplimiento:** las campañas y "te extrañamos" son comunicaciones comerciales → requieren `marketingConsent` vigente
para ese negocio. La encuesta y los avisos de fidelización son mensajes de servicio → se envían a clientes con correo
que tienen relación con el negocio, pero **cada correo incluye la opción de no recibir más de ese tipo**. Nadie recibe
correos si está en la lista de supresión (rebote o reclamo).

Lo que ya existe y debes reutilizar:
- Contactos por negocio (`ContactEntity`: `email`, `mobile`, `publicCustomerId`), pedidos de la carta (`customer_orders`),
  ventas del POS (`transactions`), encuesta de la carta (etapa 4: `customer_feedback`, `create-public-order-feedback`).
- Fidelización (etapa 7): saldos, movimientos, recompensas y vencimiento.
- Módulo legal (#77): `consentRecords` y el documento `marketingConsent` por negocio (aceptar y retirar).
- Correos: `ResendEmailUseCase`, `TemplateService` y plantillas Handlebars en `libs/emails/common/templates/emails`
  (con `layouts/base.hbs`), `EMAIL_FROM`.
- Funciones y límites de plan (seeds de `billing`), jobs diarios (como el de facturación).

Errores: `{ statusCode, code?, message, details? }`.

# Planes, límites y permisos
| Qué | Función del plan | Límite | Permiso |
|---|---|---|---|
| Panel de clientes y segmentos | nueva `customerInsights` (Emprende, Pro, Empresa) | — | ver `customers:see-module` |
| Mensajes automáticos y campañas | nueva `customerMessaging` (Pro, Empresa) | nuevo `customerEmailsMonth` (correos al mes por negocio): Pro 5.000, Empresa 25.000 | módulo nuevo `MESSAGING`: `messaging:see-module`, `messaging:manage-automations`, `messaging:send-campaigns` (dueño y administrador) |

- Al llegar al límite: los envíos quedan en `skipped` con motivo `quotaExceeded` (las campañas no se envían a medias sin
  avisar: 409 `MESSAGING_QUOTA_EXCEEDED` con `details: { used, limit, needed }` al intentar enviar).
- Agregar `customerEmailsMonth` a `limits` y `usage` de las entitlements.

---

# Parte A: Panel de clientes
## Métricas por contacto (calculadas, por negocio)
`firstVisitAt`, `lastVisitAt`, `visits` (días distintos con compra pagada o pedido de la carta aceptado, últimos 365 días),
`visits90d`, `totalSpent`, `avgTicket`, `channels` (`table` | `pickup` | `delivery` | `pos`), `segment`,
`marketingConsent: boolean` (aceptación vigente de `marketingConsent` de este negocio), `hasEmail`, `isVerified`
(etapa 10), `suppressed` (rebote o reclamo).

Guardar en una tabla `customer_metrics` (businessId, contactId, …) recalculada por un job diario y al cerrar cada venta.

## Segmentos (configurables por negocio)
```ts
SegmentSettings = {
  newDays: number,          // primera visita hace ≤ N días (defecto 30)
  frequentVisits: number,   // ≥ N visitas en 90 días (defecto 3)
  atRiskDays: number,       // frecuente sin visitas hace > N días (defecto 30)
  lostDays: number,         // sin visitas hace > N días (defecto 90)
  vipTopPercent: number     // el N % que más gasta en 365 días (defecto 10)
}
segment: 'new' | 'frequent' | 'atRisk' | 'lost' | 'vip' | 'occasional'
```
- Un contacto tiene un solo segmento (prioridad: `vip`, `atRisk`, `frequent`, `new`, `lost`, `occasional`).

## Endpoints
| Método | Ruta | Para |
|---|---|---|
| GET | `/customers/insights?segment=&q=&locationId=&marketingConsent=&page=&limit=&sort=` | Lista con métricas (`sort`: `lastVisitAt`, `totalSpent`, `visits`) |
| GET | `/customers/insights/summary?locationId=` | `{ total, bySegment: Record<segment, number>, withEmail, withMarketingConsent, suppressed }` |
| GET | `/customers/{id}/insights` | Métricas del contacto + últimos 10 pedidos/ventas + mensajes recibidos |
| GET / PATCH | `/customers/segments-settings` | `SegmentSettings` (parcial; 400 `SEGMENT_SETTINGS_INVALID` con `details.field`) |
| GET | `/customers/insights/export?…&format=csv` | Exportación (sin preferencias de salud) |

---

# Parte B: Mensajes automáticos (`customerMessaging`)
Tabla `messaging_automations` (una por negocio y tipo):
```
businessId, type ('postVisitSurvey' | 'loyaltyRewardAvailable' | 'loyaltyPointsExpiring' | 'winBack'),
isEnabled (default false), subject (≤120), body (markdown simple, ≤2000, con variables), delayHours (survey: 2–72, defecto 3),
daysBefore (puntos por vencer: 3–30, defecto 7), cooldownDays (no repetir al mismo cliente: defecto 30), ctaLabel (≤40),
updatedBy, updatedAt
```
- **Variables** permitidas en `subject` y `body`: `{{customerName}}`, `{{businessName}}`, `{{locationName}}`,
  `{{balance}}`, `{{rewardName}}`, `{{expiresAt}}`, `{{menuUrl}}`. Otra variable → 400 `MESSAGING_TEMPLATE_INVALID`
  (`details.variable`). Textos por defecto en español para cada tipo.
- **Cuándo se envía:**
  - `postVisitSurvey`: `delayHours` después de un pedido de la carta entregado/pagado o una venta del POS pagada con
    contacto con correo; enlace a la encuesta de la etapa 4 (token de un solo uso por pedido o venta).
  - `loyaltyRewardAvailable`: cuando el saldo alcanza el costo de una recompensa (una vez por recompensa y periodo).
  - `loyaltyPointsExpiring`: `daysBefore` antes de que venza el saldo (si el programa tiene vencimiento).
  - `winBack`: cuando el contacto entra al segmento `atRisk` (o `lost`); **requiere `marketingConsent`**.
- Respeta `cooldownDays`, la supresión y las bajas por tipo. Job cada hora para los programados.

| Método | Ruta | Para |
|---|---|---|
| GET | `/messaging/automations` | Lista de los 4 tipos (con los textos por defecto si no se han configurado) |
| PATCH | `/messaging/automations/{type}` | Parcial |
| POST | `/messaging/automations/{type}/test` | `{ email? }` → envía una prueba al usuario actual (no cuenta para el cliente) |
| GET | `/messaging/automations/{type}/preview` | HTML de vista previa con datos de ejemplo |

# Parte C: Campañas por correo (`customerMessaging`)
Tabla `messaging_campaigns`:
```
id, businessId, name (≤80), subject (≤120), preheader (≤150), body (markdown simple ≤5000, mismas variables),
ctaLabel, ctaUrl (https o la carta del local), imageFileId (opcional, carpeta de archivos de marketing),
audience: { segments: segment[], locationId?: number | null, onlyVerified?: boolean },
status ('draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'), scheduledAt, sentAt,
stats: { recipients, sent, failed, bounced, complained, opened, clicked, unsubscribed }, createdBy, createdAt, updatedAt
```
| Método | Ruta | Para |
|---|---|---|
| GET / POST | `/messaging/campaigns` | Listar y crear un borrador |
| PATCH | `/messaging/campaigns/{id}` | Editar (solo `draft` o `scheduled`) |
| DELETE | `/messaging/campaigns/{id}` | Borrar un borrador |
| GET | `/messaging/campaigns/{id}/audience` | `{ recipients, excluded: { noConsent, noEmail, suppressed, unsubscribed } }` |
| GET | `/messaging/campaigns/{id}/preview` | HTML de vista previa |
| POST | `/messaging/campaigns/{id}/test` | `{ email? }` → prueba al usuario actual |
| POST | `/messaging/campaigns/{id}/send` | `{ scheduledAt? }` → enviar ahora o programar (409 `MESSAGING_QUOTA_EXCEEDED`, 400 `MESSAGING_AUDIENCE_EMPTY`) |
| POST | `/messaging/campaigns/{id}/cancel` | Cancelar una programada |

- **Destinatarios:** contactos del negocio con correo, `marketingConsent` vigente, sin supresión ni baja de campañas,
  en los segmentos elegidos. Envío por lotes con el límite de Resend.
- **Aperturas y clics:** con el seguimiento de Resend (webhooks), si se activa; si no, solo envío, rebote y reclamo.

# Parte D: Envíos, bajas y supresión
Tablas `messaging_messages` (cada correo: tipo o campaña, contacto, correo, estado `queued|sent|failed|bounced|complained|skipped`,
motivo, `providerId`, fechas) y `messaging_suppressions` (correo, motivo `bounce|complaint|manual`, fecha).
- **Webhook de Resend** (`POST /webhooks/resend`, firma Svix): actualiza estados; un rebote duro o un reclamo agregan el
  correo a la supresión (de toda la plataforma).
- **Darse de baja:** cada correo lleva un enlace `{PUBLIC_FRONT}/carta/baja?token=…` (token firmado con negocio,
  contacto y tipo) y el encabezado `List-Unsubscribe` (y `List-Unsubscribe-Post` para un clic).
  - `GET {PUBLIC}/messaging/unsubscribe?token=` → `{ businessName, email (enmascarado), type, options: ['thisType', 'allFromBusiness'] }`
  - `POST {PUBLIC}/messaging/unsubscribe` `{ token, scope: 'thisType' | 'allFromBusiness' }` → registra la baja; si es de
    campañas o de todo, también **retira `marketingConsent`** en el módulo legal (`withdraw`, canal `email`).
- Toda baja queda registrada y se respeta en los envíos siguientes.

# Parte E: Ayuda
Artículos: "Conoce a tus clientes" (segmentos), "Mensajes automáticos", "Campañas por correo" y "Bajas y buenas
prácticas".

# Contrato para el front (resumen)
Panel (`/customers/insights*`, `/customers/segments-settings`), automatizaciones (`/messaging/automations*`), campañas
(`/messaging/campaigns*`), baja pública (`{PUBLIC}/messaging/unsubscribe`), `customerEmailsMonth` en entitlements;
códigos `SEGMENT_SETTINGS_INVALID`, `MESSAGING_TEMPLATE_INVALID`, `MESSAGING_QUOTA_EXCEEDED`, `MESSAGING_AUDIENCE_EMPTY`,
`MESSAGING_CAMPAIGN_LOCKED` (editar una enviada), `PLAN_FEATURE_NOT_INCLUDED`.

# Verificación
1. Sin activar nada → ningún correo nuevo; el panel muestra segmentos (Emprende).
2. Activar `postVisitSurvey` con 3 h → una venta pagada con contacto con correo → a las 3 h llega el correo con el
   enlace a la encuesta; otra venta al día siguiente → no se repite (cooldown).
3. Campaña al segmento `frequent` → `audience` excluye a los sin `marketingConsent`; enviar → llega solo a los que aceptaron.
4. Darse de baja desde el correo con "todo" → `marketingConsent` queda retirado en la auditoría legal y no recibe más.
5. Rebote simulado (webhook) → el correo queda suprimido y no recibe nada más.
6. Plan Emprende → panel sí; mensajes y campañas 403. Llegar al límite → 409 `MESSAGING_QUOTA_EXCEEDED`.
