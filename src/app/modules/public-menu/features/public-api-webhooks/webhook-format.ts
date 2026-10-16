import { WebhookDeliveryResultDto } from 'src/app/modules/public-menu/data-access';

/** Toast para el resultado de Probar o Reenviar. */
export function deliveryResultMessage(result: WebhookDeliveryResultDto): { message: string; type: 'success' | 'warning' | 'error' } {
  if (result.status === 'delivered') return { message: `Entregado${result.lastStatusCode ? ` (${result.lastStatusCode})` : ''}`, type: 'success' };
  const detail = result.lastStatusCode ? `tu servidor respondió ${result.lastStatusCode}` : (result.lastError ?? 'sin respuesta');
  if (result.status === 'pending') return { message: `No se entregó (${detail}). Se reintentará más tarde.`, type: 'warning' };
  return { message: `Falló el envío: ${detail}`, type: 'error' };
}

/** Ejemplo de verificación de la firma en Node.js (Express). */
export const NODE_VERIFY_SNIPPET = `import crypto from 'node:crypto';
import express from 'express';

const app = express();
const SECRET = process.env.REDOM_WEBHOOK_SECRET; // whsec_...

// Usa el cuerpo crudo: la firma se calcula sobre los bytes exactos.
app.post('/webhooks/redom', express.raw({ type: 'application/json' }), (req, res) => {
  const header = req.get('X-Redom-Signature') ?? '';
  const { t, v1 } = Object.fromEntries(header.split(',').map((part) => part.split('=')));
  const expected = crypto.createHmac('sha256', SECRET).update(\`\${t}.\${req.body}\`).digest('hex');

  const valid =
    v1 && v1.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 5 * 60;
  if (!valid || !fresh) return res.sendStatus(400);

  const { id, event, data } = JSON.parse(req.body.toString('utf8'));
  // Responde rápido (2xx en menos de 5 s) y procesa después.
  res.sendStatus(200);
  // ...guarda el pedido "data" según "event" (usa "id" para no procesarlo dos veces)
});`;

export const PAYLOAD_EXAMPLE = `POST https://api.tusitio.cl/webhooks/redom
Content-Type: application/json
X-Redom-Event: order.created
X-Redom-Delivery: 1234
X-Redom-Signature: t=1760450000,v1=5f2b…

{
  "id": "…",
  "event": "order.created",
  "createdAt": "2026-10-14T15:30:00.000Z",
  "data": { …el pedido, igual que GET /public/v1/orders/{id}… }
}`;
