# Prompt para el backend: Contenido con IA para la carta (Etapa 9)

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Requiere las etapas 1 a 8. Plan completo en el front: `docs/plan-carta-personalizada.md` (Etapa 9).
> **Sin fotos con IA:** la mejora de fotos queda para una etapa 9b, después de medir el costo.

---

# Contexto
Trabajas en el BACKEND de REDOM (SaaS para restaurantes; NestJS + TypeORM + PostgreSQL). Repo: `redom-chile-backend`.

Objetivo: que el dueño tenga una carta atractiva en minutos, con ayuda de la IA y siempre con su aprobación:
1. **Descripciones sugeridas** de productos (una o en lote).
2. **Etiquetas sugeridas** (dieta y alérgenos) a partir de la receta.
3. **Sugerencias de precio y promociones** a partir de las ventas y el food cost.
4. Un **resumen "Mejorar mi carta"** con lo que falta (sin descripción, sin foto, sin etiquetas, margen bajo).

**Principio SaaS (obligatorio):** el plan marca el máximo; cada negocio activa la IA y la configura. Todo parte
**apagado**. La IA **nunca publica sola**: sugiere y el dueño aplica.

Lo que ya existe y debes reutilizar:
- Cliente de Anthropic y patrón de cuota mensual en Redis: `menu-translations.service.ts` (`TRANSLATIONS_MODEL` →
  `HELP_MODEL` → `claude-haiku-5-5`, `quotaKey` por negocio y mes, timeout y reintentos) y el asistente de ayuda
  (`help-assistant.service.ts`, con `PlanLimitCode.AI_QUESTIONS_MONTH` y `entitlements.plansAbove`).
- Registro de uso y costos de IA que muestra la Plataforma (Centro de ayuda → Uso y costos): sumar este uso con su
  propia etiqueta.
- Recetas por variación (`/inventory/recipes`), food cost (`find-food-cost`), ventas (`orders`/`payments`), etiquetas
  (`find-product-tags`, `update-product-tags`), promociones (etapa 2) y `PUT /products/{id}`.
- Funciones de plan: seeds como `1758200080000-populateMenuLanguagesLoyaltyFeatures.ts`; límites en `plan_limits`.

Errores: `{ statusCode, code?, message, details? }` con `code` en todo lo que el front deba explicar.

# Planes, límites y permisos
| Qué | Plan | Límite mensual | Permiso |
|---|---|---|---|
| Descripciones y etiquetas sugeridas (`menuAiContent`) | Pro, Empresa | nuevo `aiMenuContentMonth`: Pro 100, Empresa 500 (sugerencias de descripción; las etiquetas no cuentan) | `products:update-product` |
| Sugerencias de precio y promociones | Pro, Empresa (misma función) | sin cuota (cálculo propio, 1 actualización manual al día) | `products:see-module` |
| Configuración de la IA | Pro, Empresa | — | `public-menu:manage-settings` |

- Seed `menuAiContent` ("Contenido de la carta con IA") en pro y empresa, y el límite `aiMenuContentMonth` en
  `PlanLimitCode` (los códigos nuevos de esta etapa van en camelCase; los existentes no cambian), con sus valores por plan (ajustables desde Plataforma → Planes).
- Sin la función: 403 `PLAN_FEATURE_NOT_INCLUDED` (`details.requiredPlans`).

---

# Parte A: Configuración por negocio
Entidad `MenuAiSettings` (una por negocio; nombres nuevos de la etapa 9 en camelCase):
```
businessId (PK), isEnabled boolean default false, tone default 'friendly'   -- 'friendly' | 'formal' | 'fun'
length default 'short'              -- 'short' (≤160) | 'medium' (≤320)
monthlyLimit integer null           -- tope propio por debajo del plan (null = el del plan)
insightsEnabled boolean default false
insightsFrequency default 'weekly'  -- 'weekly' | 'monthly'
updatedBy, updatedAt
```
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/menu-ai/settings` | | `AiSettings` |
| PATCH | `/menu-ai/settings` | parcial | `AiSettings` |

```ts
AiSettings = { isEnabled, tone, length, monthlyLimit: number | null, insightsEnabled, insightsFrequency,
               quota: { used, limit /* min(plan, monthlyLimit) */, planLimit }, updatedAt }
```
- `monthlyLimit` no puede superar el del plan (400 `AI_SETTINGS_INVALID` con `details.field`).

---

# Parte B: Descripciones sugeridas
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/menu-ai/descriptions` | `{ productIds?: number[] (≤20), scope?: 'missing', tone?, length? }` | `DescriptionSuggestions` |
| POST | `/menu-ai/descriptions/apply` | `{ items: [{ productId, description }] }` (≤50) | `{ count }` |

```ts
DescriptionSuggestions = {
  suggestions: [{ productId, productName, current: string | null, options: string[] /* 3 */ }],
  remaining: number,        // con scope 'missing': cuántos productos sin descripción quedan
  quota: { used, limit }
}
```
- `scope: 'missing'`: productos a la venta sin descripción, de a 20 por llamada.
- Contexto para el modelo: nombre del producto, categoría, variedades, ingredientes de la receta (si hay), etiquetas,
  nombre y tipo del local, tono y largo elegidos. Español de Chile.
- **Reglas del texto** (en el prompt del modelo y validadas después): no inventar ingredientes que no estén en el nombre
  o la receta; **no afirmar dieta ni alérgenos** ("sin gluten", "vegano") si no están en las etiquetas; sin precios; sin
  emojis; respetar el largo (recortar si se pasa).
- Cada producto con sugerencias cuenta 1 en la cuota. Sin cuota: 429 `AI_CONTENT_QUOTA_EXCEEDED`
  (`details: { used, limit }`).
- `apply` guarda la descripción (como `PUT /products/{id}`) y marca el origen para auditoría (`descriptionSource = 'ai'` y
  `descriptionUpdatedAt`), invalida la caché de la carta y marca la traducción como desactualizada (etapa 7).
- Con la IA apagada en la configuración: 409 `AI_CONTENT_DISABLED`. Modelo caído: 503 `AI_CONTENT_UNAVAILABLE`.

---

# Parte C: Etiquetas sugeridas
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/menu-ai/tags` | `{ productIds?: number[] (≤50), scope?: 'missing' }` | `TagSuggestions` |

```ts
TagSuggestions = { suggestions: [{ productId, productName,
                   add: [{ code, name, kind, reason }],      // reason: "La receta tiene harina de trigo"
                   remove: [{ code, name, kind, reason }] }] }   // etiquetas que contradicen la receta
```
- Solo productos **con receta**; se basa en los ingredientes (reglas por ingrediente y la IA para clasificar los que no
  estén en las reglas). Nunca se aplica solo: el front usa `PUT /products/{id}/tags` (ya existe).
- No cuenta en la cuota (o con un tope diario anti abuso de 200 productos).

---

# Parte D: Sugerencias de precio y promociones ("Mejorar mi carta")
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/menu-ai/overview?locationId=` | | `Overview` |
| GET | `/menu-ai/insights?locationId=` | | `Insight[]` (las vigentes) |
| POST | `/menu-ai/insights/refresh` | `{ locationId? }` | `Insight[]` (máximo 1 al día; 429 `AI_INSIGHTS_RATE_LIMITED` con `details.nextAt`) |
| POST | `/menu-ai/insights/{id}/dismiss` | | 204 |

```ts
Overview = {
  counts: { products, withoutDescription, withoutPhoto, withoutTags /* con receta y sin dieta/alérgenos */, lowMargin },
  quota: { used, limit }, settings: { isEnabled, insightsEnabled }, lastInsightsAt
}
Insight = {
  id, kind: 'lowMargin' | 'priceIncrease' | 'slowDayPromo' | 'starProduct' | 'deadProduct',
  productId: number | null, productName: string | null,
  title, detail,                     // en español, cortos
  metrics: Record<string, number>,   // p. ej. { foodCostPercent, margin, units30d, salesByWeekday... }
  action: { type: 'editPrice', productId, suggestedPrice }
        | { type: 'createPromotion', productId, weekday, suggestedPercent }   // ver aclaración 5
        | { type: 'editProduct', productId } | null,
  createdAt
}
```
- Las cifras salen de reglas sobre los datos (ventas de 30 y 90 días, food cost, día de la semana). La IA solo redacta
  `title` y `detail` (y es opcional: si falla, usar textos fijos).
  - `lowMargin`: food cost sobre un umbral (por ejemplo 35%) o margen bajo con ventas relevantes.
  - `priceIncrease`: producto muy vendido con margen bajo → precio sugerido redondeado a $100.
  - `slowDayPromo`: el día con menos ventas → promoción sugerida en productos de buen margen.
  - `starProduct` / `deadProduct`: top y productos sin ventas en 30 días.
- Se generan según `insightsFrequency` (job diario que revisa a quién le toca) y con `refresh` manual. Solo con
  `insightsEnabled`.
- Las acciones no se ejecutan solas: el front abre la edición del precio o la creación de la promoción ya rellenada.

---

# Parte E: Ayuda y Plataforma
- Artículos del Centro de ayuda (seed): "Mejora tu carta con IA", "Descripciones sugeridas", "Etiquetas sugeridas" y
  "Sugerencias de precio y promociones".
- Uso y costo de esta IA en Plataforma (como el asistente y la traducción).

# Aclaraciones (v2, 2026-10-24)
Si ya empezaste con la versión anterior, solo agrega esto:
1. **Descripciones con `scope: 'missing'`:** aceptar `excludeIds?: number[]` para no volver a sugerir (ni cobrar cuota de)
   los productos que el dueño omitió en esta sesión.
2. **Etiquetas actuales:** `GET /products/{id}` no trae las etiquetas del producto (#51), así que el front no puede
   mezclar las sugeridas sin borrar las que ya tiene. En `TagSuggestions`, agregar por producto
   `current: [{ code, name, kind }]` (sus etiquetas hoy). Ideal: resolver también #51 (etiquetas en el producto).
3. **Formatos:** `weekday` de 0 a 6 empezando el **domingo** (igual que los horarios y las promociones);
   `suggestedPrice` en pesos y **con IVA**, igual que los precios que ve el cliente.
4. **`metrics`:** usar solo estas claves (números): `foodCostPercent` (0–100), `marginPercent` (0–100),
   `margin` ($ por unidad), `units30d`, `revenue30d` ($), `unitsLastWeek`, `salesWeekday` (0–6, el día más flojo),
   `salesWeekdayShare` (0–100, % de ventas de ese día).
5. **Promoción sugerida:** cada promoción de la etapa 2 aplica a un solo producto o categoría. En
   `createPromotion`, usar `productId` (uno) en vez de `productIds`, o devolver una sugerencia por producto.

# Contrato para el front (resumen)
`AiSettings`, `DescriptionSuggestions`, `TagSuggestions`, `Overview`, `Insight`; códigos `AI_SETTINGS_INVALID`,
`AI_CONTENT_DISABLED`, `AI_CONTENT_QUOTA_EXCEEDED`, `AI_CONTENT_UNAVAILABLE`, `AI_INSIGHTS_RATE_LIMITED`,
`PLAN_FEATURE_NOT_INCLUDED`.

# Verificación
1. Negocio Pro sin activar la IA → `POST /menu-ai/descriptions` responde 409 `AI_CONTENT_DISABLED`.
2. Activarla y pedir sugerencias de 3 productos → 3 opciones por producto, sin afirmar alérgenos que no están en las
   etiquetas; la cuota sube en 3.
3. `apply` → la carta pública muestra la descripción nueva y la traducción queda desactualizada.
4. `scope: 'missing'` con 45 productos sin descripción → 20 sugerencias y `remaining: 25`.
5. Etiquetas: un producto con harina en la receta y sin etiqueta → sugiere el alérgeno gluten con su razón.
6. Insights: con ventas de prueba, aparece `slowDayPromo` para el día más flojo; `dismiss` lo oculta; `refresh` dos
   veces el mismo día → 429.
7. Plan Emprende → 403 `PLAN_FEATURE_NOT_INCLUDED` con `requiredPlans`.
