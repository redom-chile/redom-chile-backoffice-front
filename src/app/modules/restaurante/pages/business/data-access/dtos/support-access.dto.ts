/** Acceso de soporte (#50): el dueño autoriza a Redom a gestionar su carta. Backend: libs/restaurant/support-access. */

export const SUPPORT_ACCESS_DAYS = [1, 3, 7, 14, 30] as const;
export type SupportAccessDays = (typeof SUPPORT_ACCESS_DAYS)[number];

export type SupportGrantDto = Readonly<{
  id: number;
  scopes: string[];
  note: string | null;
  grantedAt: string;
  grantedByName: string | null;
  expiresAt: string;
  /** null: Redom todavía no entra. */
  firstUsedAt: string | null;
  endedAt: string | null;
  endedByName: string | null;
  endReason: 'revoked' | 'expired' | null;
  active: boolean;
  changes: Readonly<{ created: number; updated: number; deleted: number }>;
}>;

/** history: los últimos 10 terminados. */
export type SupportAccessStateDto = Readonly<{ active: SupportGrantDto | null; history: SupportGrantDto[] }>;

export type SupportEventType =
  | 'granted'
  | 'extended'
  | 'used'
  | 'revoked'
  | 'expired'
  | 'entity_created'
  | 'entity_updated'
  | 'entity_deleted'
  | 'email_failed';

export type SupportEventDto = Readonly<{
  id: number;
  grantId: number;
  type: SupportEventType;
  actorRole: 'owner' | 'superadmin' | 'system';
  /** "Soporte Redom (Nombre)" para Redom; null para el sistema. */
  actorName: string | null;
  entity: string | null;
  entityId: string | null;
  /** "Creó el producto Lomo a lo pobre". */
  summary: string | null;
  createdAt: string;
}>;
