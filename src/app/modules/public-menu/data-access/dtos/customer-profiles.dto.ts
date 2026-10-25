/** Etapa 10: cliente reconocido (plan customerProfiles). */

export type CustomerProfilesMode = 'verified' | 'browserOnly';
/** Por ahora solo correo (otro canal: 400 OTP_CHANNEL_NOT_SUPPORTED). */
export type OtpChannel = 'email';

/** Por local (menu-settings). */
export type CustomerProfilesSettingsDto = Readonly<{
  enabled: boolean;
  mode: CustomerProfilesMode;
  channel: OtpChannel;
  /** Pedir teléfono (opcional; no se verifica). */
  askPhone: boolean;
  showUsual: boolean;
  showLoyalty: boolean;
  /** null: el texto de Redom. */
  consentText: string | null;
  privacyUrl: string | null;
}>;

/**
 * En la carta pública (null: apagado o sin plan). consentText es el texto final; en browserOnly askPhone, showUsual y
 * showLoyalty llegan en false.
 */
export type PublicCustomerProfilesDto = Readonly<
  Omit<CustomerProfilesSettingsDto, 'consentText'> & { consentText: string; consentVersion: string; redomPrivacyUrl: string }
>;

/** details.setting de 409 CUSTOMER_PROFILES_DISABLED. */
export type CustomerProfilesSetting = 'enabled' | 'showUsual' | 'showLoyalty';

export const DEFAULT_CUSTOMER_PROFILES: CustomerProfilesSettingsDto = {
  enabled: false,
  mode: 'verified',
  channel: 'email',
  askPhone: false,
  showUsual: true,
  showLoyalty: true,
  consentText: null,
  privacyUrl: null,
};

export type CustomerPreferencesDto = Readonly<{
  dietTags: string[];
  allergenTags: string[];
  language: 'es' | 'en' | 'pt' | 'de' | null;
}>;

export type PublicCustomerDto = Readonly<{
  id: string;
  /** Identidad del perfil (verificada con el código). */
  email: string;
  name: string | null;
  phone: string | null;
  preferences: CustomerPreferencesDto;
  consentAt: string | null;
  createdAt: string;
}>;

/** devCode: solo fuera de producción (proveedor de desarrollo). */
export type OtpRequestResultDto = Readonly<{ channel: OtpChannel; expiresIn: number; resendIn: number; devCode?: string }>;

export type CustomerVerifyResultDto = Readonly<{ token: string; customer: PublicCustomerDto }>;

/** available false: agotado, oculto, fuera de horario o sin precio. price: el de hoy con IVA. */
export type UsualItemDto = Readonly<{ productId: number; variationId: number; name: string; available: boolean; price: number | null }>;

export type CustomerUsualDto = Readonly<{
  lastOrders: ReadonlyArray<{
    id: string;
    createdAt: string;
    channel: 'table' | 'pickup' | 'delivery';
    total: number;
    items: ReadonlyArray<UsualItemDto & Readonly<{ quantity: number }>>;
  }>;
  favorites: ReadonlyArray<UsualItemDto & Readonly<{ timesOrdered: number }>>;
}>;

/** null (cuerpo vacío): el negocio no tiene un programa activo. */
export type CustomerLoyaltyDto = Readonly<{ programName: string; mechanic: 'points' | 'stamps'; balance: number }>;

/** Header del token del cliente (no Authorization). */
export const CUSTOMER_TOKEN_HEADER = 'X-Redom-Customer';
