/** Contrato de la etapa 10.2 (backend: libs/restaurant/messaging). */

export const AUTOMATION_TYPES = ['postVisitSurvey', 'loyaltyRewardAvailable', 'loyaltyPointsExpiring', 'winBack'] as const;
export type AutomationType = (typeof AUTOMATION_TYPES)[number];

export const SEGMENTS = ['new', 'frequent', 'atRisk', 'lost', 'vip', 'occasional'] as const;
export type Segment = (typeof SEGMENTS)[number];

export const TEMPLATE_VARIABLES = ['customerName', 'businessName', 'locationName', 'balance', 'rewardName', 'expiresAt', 'menuUrl'] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export type AutomationDto = Readonly<{
  type: AutomationType;
  isEnabled: boolean;
  subject: string;
  body: string;
  ctaLabel: string | null;
  delayHours: number;
  daysBefore: number;
  cooldownDays: number;
  /** Solo winBack: va a quien aceptó novedades. */
  requiresMarketingConsent: boolean;
  /** Textos de Redom sin cambios guardados. */
  isDefault: boolean;
  updatedAt: string | null;
}>;

export type UpdateAutomationDto = Partial<{
  isEnabled: boolean;
  subject: string;
  body: string;
  ctaLabel: string | null;
  delayHours: number;
  daysBefore: number;
  cooldownDays: number;
}>;

export type PreviewDto = Readonly<{ subject: string; preheader: string | null; html: string }>;

export type TestResultDto = Readonly<{ messageId: number; email: string; status: 'sent' | 'failed' | 'skipped'; reason: string | null }>;

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';

export type CampaignAudience = Readonly<{ segments: Segment[]; locationId: number | null; onlyVerified: boolean }>;

export type CampaignStats = Readonly<
  Partial<Record<'recipients' | 'sent' | 'failed' | 'bounced' | 'complained' | 'skipped' | 'opened' | 'clicked' | 'unsubscribed', number>>
>;

export type CampaignDto = Readonly<{
  id: number;
  name: string;
  subject: string;
  preheader: string | null;
  body: string;
  ctaLabel: string | null;
  /** null: la carta del local. */
  ctaUrl: string | null;
  imageFileId: string | null;
  imageUrl: string | null;
  audience: CampaignAudience;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  /** Vacío mientras es borrador o está programada. */
  stats: CampaignStats;
  createdAt: string;
  updatedAt: string;
}>;

export type SaveCampaignDto = Partial<{
  name: string;
  subject: string;
  preheader: string | null;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageFileId: string | null;
  audience: Partial<CampaignAudience>;
}>;

export type CampaignAudienceDto = Readonly<{
  recipients: number;
  excluded: Readonly<{ noConsent: number; noEmail: number; suppressed: number; unsubscribed: number }>;
}>;

export type MessagingLocation = Readonly<{ id: number; name: string }>;
