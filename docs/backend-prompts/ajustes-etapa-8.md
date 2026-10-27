# Prompt para el backend: Ajustes después de la etapa 8

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a las solicitudes #72 y #73 de `BACKEND-REQUESTS.md` del front.

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS + TypeORM). Repo: `redom-chile-backend`. Al alinear el front con la etapa 8
(commit `79ba890b`) aparecieron dos detalles.

# 1. `chefNote` al crear un producto (#72)
`PUT /products/{id}` acepta `chefNote` (≤200, requiere `menu_design`), pero `POST /products` no lo declara y el
`ValidationPipe` (`whitelist: true`) lo descarta sin error. El front hoy crea el producto y luego hace un PUT solo con la
nota (dos llamadas; si la segunda falla, el producto queda sin nota).

**Se pide:** aceptar `chefNote?: string | null` en `CreateProductRequestDto`, con la misma validación y la misma regla
de plan que en el PUT (403 `PLAN_FEATURE_NOT_INCLUDED` sin `menu_design` si viene con texto), y devolverlo en la
respuesta.

# 2. Configuración del negocio: solo el dueño puede guardarla (#73)
`PATCH /business/{id}/settings` (`update-business-settings`) compara `business.ownerId === principal.code` y responde
**404** a cualquier otro usuario, aunque tenga `business:update-settings`. Un administrador no puede cambiar, por ejemplo,
"Orden de la carta" (`menuSortMode`), la propina sugerida o "Mostrar el IVA en la precuenta", y el front recibe un 404
que parece "el negocio no existe".

**Se pide:**
- Autorizar por el permiso `business:update-settings` (dueño y administrador por defecto), no solo por ser dueño.
- Si se quiere reservar campos sensibles al dueño (por ejemplo nombre, RUT o moneda), responder **403** con
  `code: 'OWNER_ONLY_SETTING'` y `details.fields`, no 404.

# Verificación
1. `POST /products` con `chefNote` y plan Emprende → el producto queda con la nota; en Free → 403.
2. Un administrador con `business:update-settings` cambia `menuSortMode` y `posSettings.showTaxOnPreBill` → 200.
3. Un usuario sin el permiso → 403 `PERMISSION_DENIED` (no 404).
