/** Etapa 6: API pública, llaves y webhooks (plan public_api). Backend: libs/restaurant/public-menu/src/lib/public-api-dto.ts. */

export type ApiKeyKind = 'publishable' | 'secret';

export type ApiKeyDto = Readonly<{
  id: number;
  name: string;
  kind: ApiKeyKind;
  /** "pk_live_AbC1". */
  prefix: string;
  allowedOrigins: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}>;

/** key llega SOLO en la respuesta del POST: mostrarla una vez y no guardarla. */
export type CreatedApiKeyDto = ApiKeyDto & Readonly<{ key: string }>;

/** Publicable: exige allowedOrigins (https, o http solo localhost; hasta 10). Secreta: sin orígenes. */
export type CreateApiKeyDto = Readonly<{
  name: string;
  kind: ApiKeyKind;
  allowedOrigins?: string[];
  // apiTerms vigente, mientras el negocio no lo haya aceptado (#77).
  acceptedVersionIds?: number[];
}>;

export const WEBHOOK_EVENTS = [
  'order.created',
  'order.accepted',
  'order.rejected',
  'order.cancelled',
  'order.ready',
  'order.on_the_way',
  'order.completed',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type WebhookEndpointDto = Readonly<{
  id: number;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  /** "whsec_AbC1…". */
  secretPreview: string;
  createdAt: string;
  updatedAt: string;
}>;

/** secret llega SOLO al crear o rotar. */
export type WebhookEndpointWithSecretDto = WebhookEndpointDto & Readonly<{ secret: string }>;

export type SaveWebhookEndpointDto = Readonly<{ url?: string; description?: string | null; events?: string[]; isActive?: boolean }>;

export type WebhookDeliveryResultDto = Readonly<{
  /** bigint del backend: llega como texto. */
  id: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
}>;

export type WebhookDeliveryDto = WebhookDeliveryResultDto &
  Readonly<{ event: string; nextAttemptAt: string | null; deliveredAt: string | null; createdAt: string; payload: unknown }>;
