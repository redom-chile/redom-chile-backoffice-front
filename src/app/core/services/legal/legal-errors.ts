import { HttpErrorResponse } from '@angular/common/http';
import { readApiError } from '../../utils/api-error';
import { PendingDocumentDto } from './dtos';

export const LegalErrorCode = {
  ACCEPTANCE_REQUIRED: 'LEGAL_ACCEPTANCE_REQUIRED',
  VERSION_NOT_PUBLISHED: 'LEGAL_VERSION_NOT_PUBLISHED',
  DOCUMENT_INVALID: 'LEGAL_DOCUMENT_INVALID',
} as const;

const MESSAGES: Record<string, string> = {
  [LegalErrorCode.ACCEPTANCE_REQUIRED]: 'Para seguir, acepta los documentos legales vigentes.',
  [LegalErrorCode.VERSION_NOT_PUBLISHED]: 'La versión cambió, revisa el documento de nuevo.',
  [LegalErrorCode.DOCUMENT_INVALID]: 'El documento legal no es válido. Revisa los datos e inténtalo de nuevo.',
};

/** Texto en español de un error legal (null si el error no es legal). */
export function legalErrorMessage(error: unknown): string | null {
  const code = readApiError(error).code;
  return code ? MESSAGES[code] ?? null : null;
}

export function isLegalError(error: unknown): boolean {
  return legalErrorMessage(error) !== null;
}

/** 428 de bloqueo: la sesión tiene documentos obligatorios por aceptar. */
export function isLegalBlock(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 428 &&
    readApiError(error).code === LegalErrorCode.ACCEPTANCE_REQUIRED
  );
}

/** details.documents de LEGAL_ACCEPTANCE_REQUIRED (400 o 428); null si no viene. */
export function legalDocumentsOf(error: unknown): PendingDocumentDto[] | null {
  const api = readApiError(error);
  if (api.code !== LegalErrorCode.ACCEPTANCE_REQUIRED) return null;
  const documents = api.details['documents'];
  return Array.isArray(documents) ? (documents as PendingDocumentDto[]) : null;
}

/** Los obligatorios están todos marcados. */
export function requiredAccepted(documents: readonly PendingDocumentDto[], accepted: readonly number[]): boolean {
  return documents.every((document) => !document.isRequired || accepted.includes(document.versionId));
}
