export const SEGMENTS = ['new', 'frequent', 'atRisk', 'lost', 'vip', 'occasional'] as const;
export type Segment = (typeof SEGMENTS)[number];

export type InsightsSort = 'lastVisitAt' | 'totalSpent' | 'visits';

export type CustomerInsightDto = Readonly<{
  contactId: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  visits: number;
  visits90d: number;
  orders: number;
  totalSpent: number;
  avgTicket: number;
  channels: string[];
  segment: Segment;
  segmentSince: string;
  marketingConsent: boolean;
  hasEmail: boolean;
  isVerified: boolean;
  /** Rebotó o se quejó: no se le envían correos. */
  suppressed: boolean;
}>;

export type CustomerInsightsPageDto = Readonly<{ items: CustomerInsightDto[]; total: number; page: number; limit: number }>;

export type CustomerInsightsSummaryDto = Readonly<{
  total: number;
  bySegment: Record<Segment, number>;
  withEmail: number;
  withMarketingConsent: number;
  suppressed: number;
  /** null: todavía no se calcula. */
  computedAt: string | null;
}>;

export type CustomerInsightsFilters = Readonly<{
  segment?: Segment | null;
  q?: string | null;
  locationId?: number | null;
  marketingConsent?: boolean | null;
  page?: number;
  limit?: number;
  sort?: InsightsSort;
}>;

export type CustomerSaleDto = Readonly<{
  transactionId: number;
  invoiceNo: string | null;
  date: string;
  total: number;
  channel: string;
  locationId: number;
}>;

export type MessageKind = 'automation' | 'campaign' | 'test';
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained' | 'skipped';

export type CustomerMessageDto = Readonly<{
  id: number;
  kind: MessageKind;
  type: string;
  campaignId: number | null;
  status: MessageStatus;
  reason: string | null;
  sentAt: string | null;
  createdAt: string;
}>;

export type CustomerInsightDetailDto = CustomerInsightDto & Readonly<{ lastSales: CustomerSaleDto[]; messages: CustomerMessageDto[] }>;

export type SegmentSettingsDto = Readonly<{
  newDays: number;
  frequentVisits: number;
  atRiskDays: number;
  lostDays: number;
  vipTopPercent: number;
}>;
export type SegmentSettingsField = keyof SegmentSettingsDto;
export type SegmentSettingsResponseDto = SegmentSettingsDto & Readonly<{ computedAt: string | null }>;
