/** Módulo legal global (#77). Backend: libs/auth/legal. Contenido de los documentos en markdown sin HTML. */

export const LEGAL_DOCUMENT_CODES = [
  'platformTerms',
  'privacyPolicy',
  'subscriptionTerms',
  'dataProcessingAgreement',
  'apiTerms',
  'dinerTerms',
  'dinerDataConsent',
  'marketingConsent',
] as const;
export type LegalDocumentCode = (typeof LEGAL_DOCUMENT_CODES)[number] | (string & {});

export type LegalAudience = 'platformUser' | 'businessOwner' | 'apiClient' | 'diner';

export type PendingDocumentDto = Readonly<{
  documentCode: LegalDocumentCode;
  title: string;
  versionId: number;
  version: number;
  language: string;
  isRequired: boolean;
  isMaterialChange: boolean;
  effectiveAt: string | null;
  /** '/restaurant/api/public/v1/legal/versions/{id}'. */
  url: string;
}>;

export type AcceptedDocumentDto = Readonly<{
  documentCode: LegalDocumentCode;
  title: string;
  versionId: number;
  version: number;
  action: 'accept' | 'withdraw' | 'acknowledge';
  businessId: number | null;
  createdAt: string;
  url: string;
}>;

export type LegalVersionDto = Readonly<{
  documentCode: LegalDocumentCode;
  title: string;
  versionId: number;
  version: number;
  language: string;
  /** Markdown sin HTML: renderizar con un visor que no ejecute HTML. */
  content: string;
  pdfUrl: string | null;
  contentHash: string;
  changeSummary: string | null;
  isMaterialChange: boolean;
  effectiveAt: string | null;
  status: 'published' | 'retired';
  isCurrent: boolean;
  languages: string[];
}>;

/** En la respuesta del login y en whoami. restricted: sesión que solo sirve para aceptar. */
export type SessionLegalDto = Readonly<{ restricted?: boolean; pending: PendingDocumentDto[] }>;

export type LegalMeDto = Readonly<{ pending: PendingDocumentDto[]; accepted: AcceptedDocumentDto[] }>;
