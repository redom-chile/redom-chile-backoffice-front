# Prompt para el backend: "Mis negocios" para los usuarios del negocio (no solo el dueño)

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a la solicitud #75 de `BACKEND-REQUESTS.md` del front. Es la continuación del #73.

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS + TypeORM). Repo: `redom-chile-backend`.

Con el #73, un administrador ya puede leer y guardar `GET/PATCH /business/{id}/settings`. Pero la pantalla
**Mi negocio** del front primero carga el negocio con `GET /business/my-businesses`, y ese endpoint
(`libs/restaurant/features/find-my-businesses/src/lib/infrastructure/find-my-businesses-sql.service.ts`) filtra
`where: { ownerId: principal.code }`. Para un administrador (o cualquier usuario que no sea el dueño) responde `[]`
y la pantalla queda vacía, aunque tenga `business:see-module` y `business:get-settings`.

Ejemplo en local: negocio 12 (Devom Chile); un usuario con el rol Administrador (`ADMIN`, con `business:see-module`)
no ve su negocio en Mi negocio.

# Qué hacer
1. `GET /business/my-businesses` debe devolver los negocios donde el usuario **es dueño o tiene un rol**
   (`auth.users_roles` / `users_with_roles.restaurant_id`), sin repetir.
2. Agregar a cada negocio `isOwner: boolean` (y mantener `ownerId`), para que el front sepa qué campos puede editar
   (los de solo dueño del #73).
3. Mantener el orden actual (el negocio activo primero si existe ese criterio).
4. Revisar si `find-business-onboarding-status` o `find-business-setup-steps` usan el mismo filtro por dueño: un
   administrador no debe ser enviado al onboarding ni ver "Primeros pasos" vacíos por no ser el dueño.
5. El SUPERADMIN sigue igual (no ve negocios aquí salvo los propios).

# Contrato para el front
```ts
Business = { ...lo que hay, ownerId: string, isOwner: boolean }
```

# Verificación
1. Usuario administrador de Devom Chile → `GET /business/my-businesses` devuelve Devom Chile con `isOwner: false`.
2. Dueño → el mismo negocio con `isOwner: true`.
3. Usuario sin roles en el negocio → no lo ve.
