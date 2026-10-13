# Prompt para el backend: Desplegar `billing` en AWS (desarrollo y producción)

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a la solicitud #49 de `BACKEND-REQUESTS.md` del front.

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS en Lambda + API Gateway, Terraform). Repo: `redom-chile-backend`.

La app `billing` (planes, suscripciones, Flow, plataforma del superadmin y proceso diario) funciona en local, pero
**no está publicada en AWS**:

| API Gateway | `/auth/api` | `/restaurant/api` | `/billing/api` |
|---|---|---|---|
| Desarrollo (`8wsrt1c4dk`) | 200 | 200 | **404 `{"message":"Not Found"}`** |
| Producción (`7t7c2w8zzf`, `redom-chile-common-api`) | 200 | 200 | ✅ 200 |

> Actualización: producción ya está desplegada. Falta **desarrollo**.

La infraestructura ya está escrita (commit `b5df08c0`, 9 de octubre), pero no se ha aplicado:
- `infrastructure/envs/{develop,production}/lambdas.tf`:
  - `billing_lambda_function` (`redom-chile-billing`);
  - `billing_job_lambda_function` (`redom-chile-billing-job`);
  - `aws_cloudwatch_event_rule.billing_daily` (`var.billing_job_schedule`, por defecto `cron(0 9 * * ? *)`).
- `infrastructure/envs/{develop,production}/api-gateway.tf`: ruta `ANY /billing/{proxy+}`.
- `infrastructure/envs/{develop,production}/variables.tf`:
  - `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `FLOW_API_URL`;
  - `BILLING_PUBLIC_API_URL`, `BILLING_FRONT_URL`;
  - `BILLING_ENCRYPTION_KEY`, `BILLING_ENCRYPTION_KEY_VERSION`;
  - las de Upstash.
- `source_path`: `../../../dist/apps/billing`, así que hay que compilar antes de aplicar.

# Impacto actual
- **Landing publicada (redom.cl):** la sección Precios muestra "Pronto publicaremos nuestros planes". Pide
  `/billing/api/plans/public` a través de Netlify (`projects/landing/netlify.toml` →
  `https://7t7c2w8zzf.execute-api.us-east-1.amazonaws.com/billing/api/:splat`) y recibe 404.
- **Backoffice publicado:** no funcionan Planes, Mi suscripción ni Plataforma. `whoami` sí trae
  `user.entitlements`, porque `auth` está desplegado.

# Qué hacer (primero desarrollo, después producción)

## 1. Compilar
Compilar las tres apps con la misma versión, para que `auth` y `restaurant` usen el mismo código de entitlements que
`billing`:
```
nx build billing --configuration=production   # dist/apps/billing
nx build auth --configuration=production
nx build restaurant --configuration=production
```

## 2. Variables por ambiente (tfvars o gestor de secretos; nunca en el repositorio)

| Variable | Desarrollo | Producción |
|---|---|---|
| `FLOW_API_URL` | `https://sandbox.flow.cl/api` | `https://www.flow.cl/api` |
| `FLOW_API_KEY` / `FLOW_SECRET_KEY` | claves del **sandbox** (dashboard.sandbox.flow.cl → Mis datos → Integraciones) | claves de **producción**, solo en el gestor de secretos |
| `BILLING_PUBLIC_API_URL` | `https://8wsrt1c4dk.execute-api.us-east-1.amazonaws.com/billing/api` | `https://7t7c2w8zzf.execute-api.us-east-1.amazonaws.com/billing/api` |
| `BILLING_FRONT_URL` | URL del backoffice de desarrollo (la que sirve `/billing`) | `https://app.redom.cl` |
| `BILLING_ENCRYPTION_KEY` | clave nueva de 32 bytes en base64 (`openssl rand -base64 32`) | otra clave distinta, solo en el gestor de secretos |
| `BILLING_ENCRYPTION_KEY_VERSION` | `1` | `1` |
| `URL_CORS` | debe incluir el origen del backoffice de desarrollo | debe incluir `https://app.redom.cl` |

- `BILLING_FRONT_URL` **es el backoffice, no la landing.** En local está en `http://localhost:4300` (la landing) y
  debe ser `http://localhost:4200`.
- **Nunca uses claves de producción de Flow en desarrollo:** el módulo no arranca si `NODE_ENV` no es `production`
  y `FLOW_API_URL` apunta a `www.flow.cl`.
- **No cambies `BILLING_ENCRYPTION_KEY` después de tener datos cifrados** sin rotarla: con otra clave no se pueden
  leer.

## 3. Base de datos
Correr en la base de cada ambiente las migraciones del schema `billing` y sus seeds:
- `1758200000000-billing.ts`;
- `populateBillingCatalog`;
- `createTrialSubscriptions`;
- `populateBillingPermissions`.

Los negocios existentes quedan con su prueba de Pro. Después, el superadmin pone los precios desde Plataforma.

## 4. Aplicar Terraform
```
cd infrastructure/envs/develop
terraform init
terraform plan    # revisar: billing Lambda, billing-job Lambda, ruta ANY /billing/{proxy+}, regla EventBridge
terraform apply
```
Repetir en `infrastructure/envs/production` cuando desarrollo esté validado.

## 5. Revisar el API Gateway
- La ruta `ANY /billing/{proxy+}` debe llegar a la Lambda con el path completo, porque el prefijo global de Nest es
  `billing/api`. Comprobar que `GET /billing/api/plans/public` responde 200, igual que `/restaurant/{proxy+}`.
- Si hay stage o deployment manual, publicar un deployment nuevo después del apply.

## 6. Flow
- Las URLs de retorno se arman con `BILLING_PUBLIC_API_URL`: confirmación de pago, callback de suscripción y vuelta
  del registro de tarjeta. Tienen que ser públicas, sin autenticación, y responder rápido.
- Los planes de Flow se crean al poner precios desde Plataforma. Revisar que se creen en el ambiente correcto
  (sandbox en desarrollo).

# Verificación
1. `curl https://<api-gateway>/billing/api/plans/public` → 200 con Free, Emprende y Pro.
2. `https://<api-gateway>/billing/api/docs` → Swagger con los grupos Plans, Billing y Platform.
3. **Landing publicada:** la sección Precios muestra los planes. Si la URL de producción cambia, avisar al front para
   actualizar `projects/landing/netlify.toml`, `environment.prod.ts` y `environment.develop.ts`.
4. **Backoffice publicado:**
   - como dueño: Plan y facturación → Planes y Mi suscripción cargan;
   - como superadmin: Plataforma → Resumen carga.
5. **Proceso diario:**
   - existe la regla `redom-chile-billing-daily` en EventBridge;
   - "Ejecutar proceso diario" (Plataforma → Resumen) responde con el resumen;
   - en CloudWatch está el log de la Lambda `redom-chile-billing-job`.
6. **Flow sandbox en desarrollo:** pagar Pro mensual con la tarjeta de prueba `4051 8856 0044 6623` (11/27, CVV 123)
   → vuelve a `{BILLING_FRONT_URL}/billing?card=ok&payment=paid&invoice=N`.

# Entregables
1. `billing` y `billing-job` desplegadas en desarrollo y producción, con la regla diaria activa.
2. `/billing/api/*` responde en ambos API Gateway.
3. Variables configuradas por ambiente, con los secretos fuera del repositorio.
4. Migraciones y seeds de `billing` aplicados en ambas bases.
5. URL final de `billing` por ambiente, confirmada al front.
