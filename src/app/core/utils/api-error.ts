import { HttpErrorResponse } from '@angular/common/http';

/**
 * Códigos estables que el backend envía en `{ statusCode, code, message, details? }`
 * (libs/common/utils/operators/src/lib/error-codes.ts). Se reacciona por código, nunca por el texto.
 * Sin código de negocio, el backend deriva uno del status (NOT_FOUND, CONFLICT, VALIDATION_ERROR…).
 */
export const ApiErrorCode = {
  CUSTOMER_PHONE_EXISTS: 'CUSTOMER_PHONE_EXISTS',
  SCHEDULE_OVERLAP: 'SCHEDULE_OVERLAP',
  SCHEDULE_DAY_CLOSED: 'SCHEDULE_DAY_CLOSED',
  SCHEDULE_DAY_HAS_RANGES: 'SCHEDULE_DAY_HAS_RANGES',
  SCHEDULE_EMPTY_RANGE: 'SCHEDULE_EMPTY_RANGE',
  BOOKING_INVALID_DATES: 'BOOKING_INVALID_DATES',
  BOOKING_OUTSIDE_HOURS: 'BOOKING_OUTSIDE_HOURS',
  BOOKING_TABLE_CAPACITY: 'BOOKING_TABLE_CAPACITY',
  BOOKING_TABLE_TAKEN: 'BOOKING_TABLE_TAKEN',
  BOOKING_CONTACT_OVERLAP: 'BOOKING_CONTACT_OVERLAP',
  ORDER_HAS_PAYMENTS: 'ORDER_HAS_PAYMENTS',
  ORDER_NOT_OPEN: 'ORDER_NOT_OPEN',
  TABLE_BLOCKED: 'TABLE_BLOCKED',
  TABLE_HAS_OPEN_ORDER: 'TABLE_HAS_OPEN_ORDER',
  TABLE_STATUS_AUTOMATIC: 'TABLE_STATUS_AUTOMATIC',
  CURRENT_PASSWORD_INVALID: 'CURRENT_PASSWORD_INVALID',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MODIFIER_NOT_AVAILABLE: 'MODIFIER_NOT_AVAILABLE',
  MODIFIER_REPEATED: 'MODIFIER_REPEATED',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export type ApiError = Readonly<{
  status: number;
  code: string | null;
  message: string;
  details: Record<string, unknown>;
}>;

/** Normaliza cualquier error HTTP al formato del backend. */
export function readApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) return { status: -1, code: null, message: '', details: {} };
  const body = (error.error ?? {}) as { code?: unknown; message?: unknown; details?: unknown };
  const raw = body.message;
  return {
    status: error.status,
    code: typeof body.code === 'string' ? body.code : null,
    message: String(Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')),
    details: body.details && typeof body.details === 'object' ? (body.details as Record<string, unknown>) : {},
  };
}

export function hasApiErrorCode(error: unknown, code: ApiErrorCode | string): boolean {
  return readApiError(error).code === code;
}
