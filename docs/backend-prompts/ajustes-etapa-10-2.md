# Prompt para el backend: Ajustes después de la etapa 10.2 (mensajería)

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a la solicitud #81 de `BACKEND-REQUESTS.md` del front.

---

# Contexto
Trabajas en el BACKEND de REDOM. Repo: `redom-chile-backend`. Al implementar el front de la etapa 10.2 aparecieron estos
puntos.

# 1. Los enlaces de los correos apuntan al backoffice (importante)
`messaging-sender.service.ts` arma los enlaces de la encuesta y de la baja con `URL_CORS` + `/carta/encuesta|baja`.
`URL_CORS` es el **backoffice** (`http://localhost:4200`, `app.redom.cl`), pero esas páginas viven en la **landing**
(`redom.cl/carta/...`, local `http://localhost:4300/carta/...`). Los clientes llegarían a una página que no existe.

**Se pide:** una variable propia para la carta pública, por ejemplo `PUBLIC_MENU_URL`
(`http://localhost:4300/carta` en local, `https://redom.cl/carta` en producción), y usarla en todos los enlaces públicos:
encuesta, baja, seguimiento de pedidos, QR de las mesas (hoy `QR_BASE_URL`, que también apunta a `app.redom.cl/carta`,
ver #54) y avisos legales que lleven a la carta. `URL_CORS` queda solo para CORS y enlaces del backoffice.

# 2. Slugs reservados
`RESERVED_MENU_SLUGS` (`libs/restaurant/shared/src/lib/menu-slugs.service.ts`) no incluye `encuesta`, `baja` ni
`pedido`, que son rutas fijas de la carta. Agregarlos (y revisar que ningún negocio existente los use).

# 3. "Te extrañamos" y la baja
`winBack` cuenta como comercial (`COMMERCIAL_TYPES`), pero la baja con `scope: 'thisType'` solo retira
`marketingConsent` cuando el tipo es `campaign`. Una baja de un correo comercial (campaña o `winBack`) con cualquiera de
los dos alcances debería retirar `marketingConsent` de ese negocio, y `marketingConsentWithdrawn: true` en la respuesta.

# 4. Campañas
- `GET /messaging/campaigns/{id}`: el front hoy busca la campaña en la lista.
- Vista previa de un borrador **sin guardar**: `POST /messaging/campaigns/preview` (y `/messaging/automations/{type}/preview`)
  con el contenido en el body, para no tener que guardar antes de ver.

# 5. Textos por defecto de las automatizaciones
`isDefault` deja de ser `true` apenas se guarda algo (incluso solo `isEnabled`). Para "Restaurar texto de Redom", exponer
los textos por defecto: `defaults: { subject, body, ctaLabel }` en cada `Automation` (o `GET /messaging/automations/defaults`).

# 6. Errores de rango
Los rangos inválidos (por ejemplo `delayHours`) llegan como `MESSAGING_TEMPLATE_INVALID` con `details.field`; el contrato
dice `VALIDATION_ERROR`. Unificar: `VALIDATION_ERROR` con `details.field` para rangos y `MESSAGING_TEMPLATE_INVALID` solo
para variables (`details.variable`).

# Verificación
1. Con `PUBLIC_MENU_URL=http://localhost:4300/carta`, el correo de la encuesta y el de la baja abren la landing.
2. Crear una carta con slug `encuesta` → 400 (reservado).
3. Darse de baja de "Te extrañamos" con "solo este tipo" → `marketingConsentWithdrawn: true` y la auditoría legal lo registra.
4. `GET /messaging/campaigns/{id}` y la vista previa con el body sin guardar responden 200.
