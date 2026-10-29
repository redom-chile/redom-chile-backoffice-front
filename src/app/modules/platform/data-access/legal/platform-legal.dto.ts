import { LegalAudience } from 'src/app/core/services/legal';

/** Plataforma → Legal (backend: libs/auth/legal, legal-dto.ts). Fechas en ISO. */

export const LEGAL_LANGUAGES = ['es', 'en', 'pt', 'de'] as const;
export type LegalLanguage = (typeof LEGAL_LANGUAGES)[number];

export const LEGAL_AUDIENCES: readonly LegalAudience[] = ['platformUser', 'businessOwner', 'apiClient', 'diner'];

export type LegalScope = 'platform' | 'business';
export type LegalVersionStatus = 'draft' | 'published' | 'retired';
export type LegalConsentAction = 'accept' | 'withdraw' | 'acknowledge';
export type LegalConsentChannel = 'backoffice' | 'carta' | 'email' | 'api' | 'registration';
export type LegalSubjectType = 'user' | 'publicCustomer' | 'business' | 'guest';

export type LegalVersionSummaryDto = Readonly<{
  versionId: number;
  version: number;
  language: string;
  effectiveAt: string | null;
}>;

export type LegalDocumentDto = Readonly<{
  id: number;
  code: string;
  title: string;
  audiences: LegalAudience[];
  scope: LegalScope;
  businessId: number | null;
  isRequired: boolean;
  /** Vigente ahora (es primero). */
  current: LegalVersionSummaryDto | null;
  /** Publicada para entrar en vigencia más adelante. */
  scheduled: LegalVersionSummaryDto | null;
  drafts: number;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateLegalDocumentDto = Readonly<{
  code: string;
  title: string;
  audiences: LegalAudience[];
  scope?: LegalScope;
  businessId?: number | null;
  isRequired?: boolean;
}>;

/** code, scope y businessId no cambian. */
export type UpdateLegalDocumentDto = Readonly<{ title?: string; audiences?: LegalAudience[]; isRequired?: boolean }>;

export type LegalDocumentVersionDto = Readonly<{
  id: number;
  documentId: number;
  version: number;
  language: string;
  content: string;
  fileId: string | null;
  pdfUrl: string | null;
  /** Se calcula al publicar (sha256 del contenido y el PDF). */
  contentHash: string | null;
  changeSummary: string | null;
  isMaterialChange: boolean;
  status: LegalVersionStatus;
  effectiveAt: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  retiredAt: string | null;
  notifiedAt: string | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type UpdateLegalVersionDto = Readonly<{
  language?: string;
  content?: string;
  fileId?: string | null;
  changeSummary?: string | null;
  isMaterialChange?: boolean;
  effectiveAt?: string | null;
}>;

/** version: solo para agregar un idioma a un número existente (por defecto, el siguiente). */
export type CreateLegalVersionDto = UpdateLegalVersionDto & Readonly<{ content: string; version?: number }>;

export type LegalNotifyResultDto = Readonly<{ versionId: number; sent: number; failed: number; remaining: number }>;

export type LegalFileUploadDto = Readonly<{
  fileId: string;
  key: string;
  method: 'PUT';
  uploadUrl: string;
  headers: Readonly<Record<string, string>>;
  expiresIn: number;
}>;

export type LegalAudienceStatsDto = Readonly<{
  audience: LegalAudience;
  total: number;
  accepted: number;
  pending: number;
  /** 0–100 con un decimal. */
  percent: number;
}>;

export type LegalStatsDto = Readonly<{
  documentId: number;
  documentCode: string;
  title: string;
  isRequired: boolean;
  current: LegalVersionSummaryDto | null;
  audiences: LegalAudienceStatsDto[];
}>;

export type LegalAuditFiltersDto = Readonly<{
  email?: string;
  documentCode?: string;
  businessId?: number;
  /** YYYY-MM-DD o ISO. */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}>;

export type LegalAuditRecordDto = Readonly<{
  id: number;
  documentCode: string;
  versionId: number;
  version: number;
  contentHash: string;
  action: LegalConsentAction;
  subjectType: LegalSubjectType;
  subjectId: string;
  /** sha256 una vez anonimizado. */
  email: string | null;
  businessId: number | null;
  locationId: number | null;
  channel: LegalConsentChannel;
  ip: string | null;
  userAgent: string | null;
  anonymizedAt: string | null;
  createdAt: string;
}>;

export type LegalAuditPageDto = Readonly<{ records: LegalAuditRecordDto[]; total: number; page: number; limit: number }>;
