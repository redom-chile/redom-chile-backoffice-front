// Respuesta común de los logins (email/contraseña, verificación de email y Google).
export type SessionUserDataDto = Readonly<{
  code: string;
  rut: string | null;
  name: string;
  fatherLastName: string;
  motherLastName: string | null;
  email: string;
  status: string;
  restaurantId: number | null;
  // URL firmada (vence en 1 hora): se usa solo en memoria, no se guarda en localStorage.
  profileImageUrl?: string | null;
}>;

import { PendingDocumentDto, SessionLegalDto } from 'src/app/core/services/legal';

/**
 * Con `legal.restricted` el token solo sirve para aceptar documentos (/legal/*, whoami mínimo y logout):
 * refreshToken llega null y userData solo trae code y email.
 */
export type SessionDto = Readonly<{
  token: string;
  refreshToken: string | null;
  userData: SessionUserDataDto;
  legal?: SessionLegalDto;
}>;

// Google además indica si la cuenta se creó en este inicio de sesión (va al onboarding).
export type GoogleSessionDto = SessionDto & Readonly<{ isNewUser: boolean }>;

/** Usuario nuevo de Google con documentos publicados: 428 con lo que debe aceptar (registrationToken vale 10 minutos). */
export type GoogleRegistrationDto = Readonly<{ documents: PendingDocumentDto[]; registrationToken: string }>;

export type RegisterOwnerDto = Readonly<{
  name: string;
  fatherLastName: string;
  motherLastName?: string;
  email: string;
  password: string;
  rut?: string;
  // Versiones vigentes de platformTerms y privacyPolicy aceptadas (#77).
  acceptedVersionIds?: number[];
}>;

export type RegisterOwnerResponseDto = Readonly<{ email: string; message: string }>;
