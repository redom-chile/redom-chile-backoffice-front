# Prompt para el backend: Orden manual de categorías y productos

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a la solicitud #68 de `BACKEND-REQUESTS.md` del front y es parte de la etapa 8 del plan
> (`docs/plan-carta-personalizada.md` del front).

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS + TypeORM, PostgreSQL). Repo: `redom-chile-backend`.

Hoy el orden de la carta no lo decide el negocio:
- `find-all-categories` ordena por `parentId, id` (orden de creación);
- la carta pública (`public-menu.service.ts`) ordena categorías y productos por nombre;
- `CategoryEntity` y `ProductEntity` no tienen posición.

El negocio quiere ordenar sus categorías, subcategorías y productos **arrastrándolos** (verticalmente) en el
backoffice, y que ese orden se use en la carta pública y en el POS. Redom es un SaaS: el orden lo decide cada
negocio, y puede preferir el orden alfabético.

Ya existe un patrón igual: `reorder-help-categories` (`PATCH admin/categories/reorder` con `{ ids: number[] }`).
Úsalo como referencia.

# Qué hacer

## 1. Datos (migración)
- `restaurant.categories.position` (`integer NOT NULL DEFAULT 0`), por negocio y dentro de su padre (`parent_id`).
- `restaurant.products.position` (`integer NOT NULL DEFAULT 0`), dentro de su grupo: **la subcategoría si el producto tiene `sub_category_id`, si no la categoría** (el mismo criterio con que `public-menu.service.ts` agrupa los productos en la carta). `PATCH /products/reorder` recibe en `categoryId` el id de ese grupo.
- Rellenar las posiciones actuales en **orden alfabético** (para que nada cambie de lugar al desplegar):
  categorías por negocio y padre; productos por negocio y categoría.
- Índices: `(business_id, parent_id, position)` en categorías y `(business_id, category_id, position)` en productos.
- Al crear, la categoría o el producto queda **al final** de su grupo (`max(position) + 1`).
- Al cambiar un producto de categoría, queda al final de la nueva.

## 2. Ajuste del negocio: orden manual o alfabético
- `menuSortMode: 'manual' | 'alphabetical'` en el **primer nivel** de la configuración del negocio
  (`GET/PATCH /business/{id}/settings`, junto a las demás opciones). **Por defecto `alphabetical`** para los negocios
  existentes y los nuevos. Debe venir en la respuesta del GET: el front lo vuelve a leer para confirmar que se guardó.
- Que se pueda leer y cambiar con el endpoint de configuración del negocio que ya existe.

## 3. Endpoints
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| PATCH | `/categories/reorder` | `{ parentId: number \| null, ids: number[] }` (todas las categorías de ese padre, en el nuevo orden; `null` o `0` = principales) | 204 o la lista ordenada |
| PATCH | `/products/reorder` | `{ categoryId: number, ids: number[] }` (todos los productos de esa categoría, en el nuevo orden) | 204 o la lista ordenada |

- Validar que los `ids` sean del negocio y del mismo padre o categoría, sin repetidos, y que estén todos (400
  `REORDER_IDS_MISMATCH` con `details: { missing, extra }` si no).
- Guardar en una transacción (`position = índice`).
- Permisos: `categories:update-category` para categorías y `products:update-product` (o el que corresponda) para
  productos.
- Invalidar la caché de la carta pública (`publicMenu.invalidate(businessId)`), igual que el resto de cambios de carta.

## 4. Lecturas que deben respetar el orden
- `GET /categories` (y `find-category`): devolver `position` y ordenar por `parentId, position, name`.
- `GET /products` y el selector del POS: devolver `position`; cuando se filtra por categoría, ordenar por
  `position, name`.
- **Carta pública** (`public-menu.service.ts`): con `menuSortMode = 'manual'`, categorías, subcategorías y productos por
  `position, name`; con `'alphabetical'`, por nombre como hoy.
- **POS**: mismo criterio que la carta.

# Contrato para el front
```ts
Category = { ...lo que hay, position: number }
Product  = { ...lo que hay, position: number }
BusinessSettings = { ...lo que hay, menuSortMode: 'manual' | 'alphabetical' }
```
Front: en Carta → Categorías y en la lista de productos de cada categoría habrá un control para elegir
"Orden manual" o "Alfabético" y, en manual, filas que se arrastran verticalmente (con botones subir/bajar para
teclado). Envía la lista completa del grupo después de cada movimiento.

# Verificación
1. Desplegar la migración: la carta y el POS se ven igual que antes (alfabético).
2. Cambiar a "manual", reordenar categorías y productos: la carta pública y el POS muestran el nuevo orden.
3. Crear una categoría y un producto: quedan al final de su grupo.
4. `PATCH /categories/reorder` con un id de otro negocio o faltando uno: 400 `REORDER_IDS_MISMATCH`.
5. Volver a "alfabético": la carta vuelve al orden por nombre sin perder el orden manual guardado.
