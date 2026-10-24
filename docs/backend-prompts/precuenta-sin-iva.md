# Prompt para el backend: Opción para ocultar el IVA en la precuenta

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a la solicitud #70 de `BACKEND-REQUESTS.md` del front.

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS + TypeORM). Repo: `redom-chile-backend`.

La precuenta que se imprime para el cliente (la arma el front) muestra la línea "IVA incluido $X" bajo el total. A
algunos clientes del restaurante les confunde. Redom es un SaaS: cada negocio decide si la muestra o no.

Las opciones del POS se guardan como JSON en `business.pos_settings` y el backend solo acepta las que conoce:
- `UpdatePosSettingsDto` en `libs/restaurant/features/update-business-settings/src/lib/infrastructure/dtos/update-business-settings-request.dto.ts`;
- `parsePosSettings` / `mergePosSettings` en `libs/restaurant/shared/src/lib/pos-settings.ts`, que reescriben el JSON
  solo con `waiter_enabled`, `tables_enabled` e `is_service_staff_required`.

# Qué hacer
1. Nueva opción `showTaxOnPreBill: boolean`, **por defecto `true`** (la precuenta sigue igual para todos los negocios).
2. `UpdatePosSettingsDto`: `@IsOptional() @IsBoolean() showTaxOnPreBill?: boolean`.
3. `pos-settings.ts`: leerla y escribirla como `show_tax_on_pre_bill` en `parsePosSettings` y `mergePosSettings`
   (sin perder las demás claves).
4. `GET /business/{id}/settings`: que venga en `posSettings` (como las demás opciones).
5. Permiso: el mismo que hoy cambia las opciones del POS (`business:update-settings`).

No hay que tocar documentos tributarios: la precuenta no es boleta. La boleta (cuando exista) debe seguir mostrando
el IVA según la normativa del SII.

# Contrato para el front
```ts
PosSettings = { tablesEnabled, waiterEnabled, isServiceStaffRequired, showTaxOnPreBill }   // GET y PATCH parcial
```

# Verificación
1. Negocio existente sin la opción: `GET /business/{id}/settings` trae `showTaxOnPreBill: true` (o ausente = true).
2. `PATCH /business/{id}/settings { posSettings: { showTaxOnPreBill: false } }` → el GET la trae en `false` y las demás
   opciones del POS no cambian.
3. Volver a `true` → la precuenta vuelve a mostrar el IVA.
