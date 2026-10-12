export type OnboardingStepId = 'business' | 'location' | 'service' | 'products' | 'photo' | 'done';

export type OnboardingStep = Readonly<{ id: OnboardingStepId; label: string; optional: boolean }>;

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: 'business', label: 'Tu negocio', optional: false },
  { id: 'location', label: 'Tu local', optional: false },
  { id: 'service', label: '¿Cómo atiendes?', optional: true },
  { id: 'products', label: 'Tus primeros productos', optional: true },
  { id: 'photo', label: 'Tu foto', optional: true },
  { id: 'done', label: '¡Listo!', optional: false },
];

export type ServiceMode = 'counter' | 'tables' | 'both';

export type CreatedLocation = Readonly<{ id: number; name: string }>;

export type ServiceResult = Readonly<{
  mode: ServiceMode;
  sectorName: string | null;
  tablesCreated: number;
}>;

// Lo escrito en "Tu local", para no perderlo al volver a "Tu negocio" (aún no se guarda nada).
export type LocationDraft = Readonly<{
  name: string;
  address: string;
  city: string;
  mobile: string;
  // El usuario cambió el nombre: ya no se copia el del negocio.
  nameEdited: boolean;
}>;
