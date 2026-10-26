export const LEGAL_LANGUAGE_LABELS: Record<string, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  de: 'Deutsch',
};

export const languageLabel = (code: string) => LEGAL_LANGUAGE_LABELS[code] ?? code.toUpperCase();

/** "25 de octubre de 2026" (null si no hay fecha). */
export function formatLegalDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Página pública del documento (la misma que enlazan los correos). */
export function legalPageUrl(code: string, versionId?: number): string {
  return versionId ? `/legal/${encodeURIComponent(code)}?version=${versionId}` : `/legal/${encodeURIComponent(code)}`;
}
