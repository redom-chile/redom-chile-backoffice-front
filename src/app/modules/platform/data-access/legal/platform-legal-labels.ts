import { AUTH_PERMISSIONS } from 'src/app/core/permissions/auth.permissions';
import { LEGAL_DOCUMENT_CODES, LegalAudience } from 'src/app/core/services/legal';
import { readApiError } from 'src/app/core/utils/api-error';
import { PLATFORM_TIME_ZONE } from '../platform-labels';
import { getPlatformErrorMessage } from '../platform-error-message';
import { LegalConsentAction, LegalConsentChannel, LegalDocumentVersionDto, LegalSubjectType } from './platform-legal.dto';

/** Copia de Permission.AUTH.LEGAL (backend). Se consultan con AccessService.owns. */
/** Permisos del módulo Legal (backend: Permission.AUTH.LEGAL). */
export const LEGAL_PERMISSIONS = AUTH_PERMISSIONS.LEGAL;

/** camelCase de 2 a 60 letras y dígitos (igual que el backend). */
export const LEGAL_CODE_PATTERN = /^[a-z][a-zA-Z0-9]{1,59}$/;
export const LEGAL_TITLE_MAX = 160;
export const LEGAL_SUMMARY_MAX = 500;
export const LEGAL_CONTENT_MAX = 200_000;

export const LEGAL_AUDIENCE_LABELS: Record<LegalAudience, string> = {
  platformUser: 'Usuarios del backoffice',
  businessOwner: 'Negocios (dueño)',
  apiClient: 'Clientes de la API',
  diner: 'Comensales',
};

export const LEGAL_LANGUAGE_LABELS: Record<string, string> = { es: 'Español', en: 'Inglés', pt: 'Portugués', de: 'Alemán' };

export const LEGAL_ACTION_LABELS: Record<LegalConsentAction, string> = { accept: 'Aceptó', withdraw: 'Retiró', acknowledge: 'Informado' };

export const LEGAL_CHANNEL_LABELS: Record<LegalConsentChannel, string> = {
  backoffice: 'Backoffice',
  carta: 'Carta',
  email: 'Correo',
  api: 'API',
  registration: 'Registro',
};

export const LEGAL_SUBJECT_LABELS: Record<LegalSubjectType, string> = { user: 'Usuario', publicCustomer: 'Comensal', business: 'Negocio', guest: 'Invitado' };

type LegalPreset = Readonly<{ title: string; audiences: LegalAudience[]; isRequired: boolean }>;

/** Catálogo estándar de Redom (docs/legal.md del backend), para crearlo con un clic si falta. */
export const LEGAL_STANDARD_PRESETS: Record<(typeof LEGAL_DOCUMENT_CODES)[number], LegalPreset> = {
  platformTerms: { title: 'Términos de uso de Redom', audiences: ['platformUser'], isRequired: true },
  privacyPolicy: { title: 'Política de privacidad', audiences: ['platformUser', 'diner'], isRequired: true },
  subscriptionTerms: { title: 'Condiciones de la suscripción', audiences: ['businessOwner'], isRequired: true },
  dataProcessingAgreement: { title: 'Acuerdo de tratamiento de datos', audiences: ['businessOwner'], isRequired: true },
  apiTerms: { title: 'Términos de uso de la API', audiences: ['apiClient'], isRequired: true },
  dinerTerms: { title: 'Términos para comensales', audiences: ['diner'], isRequired: true },
  dinerDataConsent: { title: 'Consentimiento de datos del comensal', audiences: ['diner'], isRequired: true },
  marketingConsent: { title: 'Consentimiento de comunicaciones comerciales', audiences: ['diner'], isRequired: false },
};

// --- Estado de una versión ---

export type LegalVersionState = 'draft' | 'scheduled' | 'current' | 'superseded' | 'retired';

export const LEGAL_VERSION_STATE_LABELS: Record<LegalVersionState, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  current: 'Vigente',
  superseded: 'Reemplazada',
  retired: 'Retirada',
};

export const LEGAL_VERSION_STATE_TONES: Record<LegalVersionState, string> = {
  draft: 'bg-[var(--muted)] text-muted-foreground',
  scheduled: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  current: 'bg-green-500/15 text-green-700 dark:text-green-400',
  superseded: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  retired: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

export function legalVersionState(version: LegalDocumentVersionDto, now = Date.now()): LegalVersionState {
  if (version.status === 'draft') return 'draft';
  if (version.status === 'retired') return 'retired';
  if (version.effectiveAt && Date.parse(version.effectiveAt) > now) return 'scheduled';
  return version.isCurrent ? 'current' : 'superseded';
}

export const shortHash = (hash: string | null | undefined) => (hash ? hash.slice(0, 12) : '—');

// --- Fechas y horas en Chile ---

/** Fecha (YYYY-MM-DD) y hora (HH:mm) de un ISO en America/Santiago, para los inputs. */
export function isoToSantiagoParts(iso: string | null | undefined): Readonly<{ date: string; time: string }> {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: PLATFORM_TIME_ZONE }).format(date),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: PLATFORM_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date),
  };
}

/** Inicio del día elegido en America/Santiago como ISO (respeta el horario de verano). */
export function startOfDayInSantiago(date: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: PLATFORM_TIME_ZONE, timeZoneName: 'longOffset' })
    .formatToParts(probe)
    .find((part) => part.type === 'timeZoneName')
    ?.value.replace('GMT', '');
  return new Date(`${date}T00:00:00${offset || '-03:00'}`).toISOString();
}

// --- Errores ---

/** Campo marcado por 400 LEGAL_DOCUMENT_INVALID (details.field), o null. */
export function legalInvalidField(error: unknown): string | null {
  const api = readApiError(error);
  return api.code === 'LEGAL_DOCUMENT_INVALID' && typeof api.details['field'] === 'string' ? (api.details['field'] as string) : null;
}

const FIELD_LABELS: Record<string, string> = {
  code: 'el código',
  title: 'el título',
  audiences: 'las audiencias',
  scope: 'el alcance',
  businessId: 'el negocio',
  isRequired: 'la obligatoriedad',
  content: 'el contenido',
  language: 'el idioma',
  version: 'el número de versión',
  changeSummary: 'el resumen de cambios',
  isMaterialChange: 'el cambio material',
  effectiveAt: 'la fecha de vigencia',
  fileId: 'el PDF',
  email: 'el correo',
  format: 'el formato',
  from: 'la fecha desde',
  to: 'la fecha hasta',
};

export function getLegalErrorMessage(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  const api = readApiError(error);
  switch (api.code) {
    case 'LEGAL_VERSION_IMMUTABLE':
      return 'Esa versión ya está publicada y no se puede cambiar: crea una versión nueva.';
    case 'LEGAL_VERSION_NOT_PUBLISHED':
      return api.message.includes('in force')
        ? 'Solo se puede avisar de la versión vigente.'
        : 'La versión no está publicada (puede que ya esté retirada).';
    case 'LEGAL_DOCUMENT_INVALID': {
      const field = typeof api.details['field'] === 'string' ? (api.details['field'] as string) : '';
      if (field === 'content') return 'El contenido debe ser markdown sin HTML ni scripts (hasta 200.000 caracteres).';
      if (field === 'code' && api.message.includes('already')) return 'Ya existe un documento con ese código.';
      if (field === 'language' && api.message.includes('already')) return 'Esa versión ya tiene ese idioma.';
      if (field === 'version' && api.message.includes('later')) return 'Ya hay publicada una versión posterior en ese idioma.';
      if (field === 'isMaterialChange') return 'Solo se avisa de un cambio material de un documento obligatorio; los demás solo se informan.';
      if (field === 'businessId') return api.message.includes('not found') ? 'El negocio no existe.' : 'Un documento de negocio necesita el ID del negocio.';
      return `Revisa ${FIELD_LABELS[field] ?? 'los datos'}${api.message ? `: ${api.message}` : '.'}`;
    }
  }
  if (api.status === 403) return 'No tienes permiso para esta acción del módulo Legal.';
  return getPlatformErrorMessage(error, fallback);
}
