import { HttpErrorResponse } from '@angular/common/http';
import { legalErrorMessage } from 'src/app/core/services/legal';
import { GoogleRegistrationExpiredError } from './google-registration-expired.error';

export type AuthErrorKind =
  | 'invalid-credentials'
  | 'google-account'
  | 'email-not-verified'
  | 'inactive'
  | 'email-taken'
  | 'rut-taken'
  | 'invalid-code'
  | 'too-many-attempts'
  | 'google-invalid'
  | 'google-other-account'
  | 'google-unverified'
  | 'google-not-configured'
  | 'google-registration-expired'
  | 'legal'
  | 'network'
  | 'unknown';

export type AuthError = Readonly<{ kind: AuthErrorKind; message: string }>;

const MESSAGES: Record<AuthErrorKind, string> = {
  'invalid-credentials': 'Email o contraseña incorrectos.',
  'google-account': 'Esta cuenta inicia sesión con Google. Usa el botón de Google o crea una contraseña con "¿Olvidaste tu contraseña?".',
  'email-not-verified': 'Tu email aún no está verificado. Te enviamos un código.',
  inactive: 'Tu cuenta está inactiva o suspendida. Contacta al administrador del negocio.',
  'email-taken': 'Ese email ya está registrado.',
  'rut-taken': 'Ese RUT ya está registrado.',
  'invalid-code': 'El código es incorrecto o ya expiró.',
  'too-many-attempts': 'Demasiados intentos. Pide un código nuevo.',
  'google-invalid': 'No pudimos validar tu cuenta de Google. Intenta nuevamente.',
  'google-other-account': 'Este email está vinculado a otra cuenta de Google.',
  'google-unverified': 'Tu email de Google no está verificado.',
  'google-not-configured': 'El acceso con Google aún no está configurado.',
  'google-registration-expired': 'Pasó mucho tiempo desde que elegiste tu cuenta de Google. Vuelve a pulsar el botón de Google.',
  legal: 'Para seguir, acepta los documentos legales vigentes.',
  network: 'No hay conexión con el servidor. Revisa tu internet.',
  unknown: 'Ocurrió un error inesperado. Intenta nuevamente.',
};

// Los mensajes del backend vienen en inglés: se identifica el caso por status + texto y se muestra en español.
export function getAuthError(error: unknown): AuthError {
  if (error instanceof GoogleRegistrationExpiredError) return { kind: 'google-registration-expired', message: MESSAGES['google-registration-expired'] };
  const legal = legalErrorMessage(error);
  if (legal) return { kind: 'legal', message: legal };
  if (!(error instanceof HttpErrorResponse)) return { kind: 'unknown', message: MESSAGES.unknown };
  const raw = error.error?.message;
  const text = (Array.isArray(raw) ? raw.join(' ') : String(raw ?? '')).toLowerCase();
  const kind = ((): AuthErrorKind => {
    if (error.status === 0) return 'network';
    if (error.status === 429) return 'too-many-attempts';
    if (text.includes('signs in with google')) return 'google-account';
    if (text.includes('not verified') && text.includes('google')) return 'google-unverified';
    if (text.includes('email not verified')) return 'email-not-verified';
    if (text.includes('linked to another google')) return 'google-other-account';
    if (text.includes('google sign-in is not configured')) return 'google-not-configured';
    if (text.includes('invalid google token')) return 'google-invalid';
    if (text.includes('verification code') || text.includes('expired')) return 'invalid-code';
    if (text.includes('email already registered')) return 'email-taken';
    if (text.includes('rut already registered')) return 'rut-taken';
    if (text.includes('not active') || text.includes('have not active status')) return 'inactive';
    if (error.status === 401) return 'invalid-credentials';
    return 'unknown';
  })();
  return { kind, message: MESSAGES[kind] };
}
