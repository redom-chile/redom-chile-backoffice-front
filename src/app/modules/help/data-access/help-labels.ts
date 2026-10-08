import { HelpModule } from './dtos';

export const HELP_MODULE_LABELS: Record<HelpModule, string> = {
  onboarding: 'Primeros pasos',
  pos: 'Punto de venta',
  orders: 'Pedidos y cobros',
  cash: 'Caja y turnos',
  products: 'Carta y productos',
  inventory: 'Inventario',
  recipes: 'Recetas y costeo',
  finance: 'Finanzas',
  tips: 'Propinas',
  settings: 'Configuración',
};

export const HELP_MODULE_OPTIONS = (Object.keys(HELP_MODULE_LABELS) as HelpModule[]).map((value) => ({
  value,
  label: HELP_MODULE_LABELS[value],
}));

/** Rol del equipo de Redom que administra el contenido (roles[].code de whoami). */
export const HELP_ADMIN_ROLE = 'SUPERADMIN';

/** Mismo formato que valida el backend para los slugs. */
export const HELP_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Texto fijo bajo el chat del asistente. */
export const HELP_ASSISTANT_DISCLAIMER = 'Responde con los artículos de ayuda de Redom. Puede equivocarse';

/** Ruta actual sin query ni fragmento, como la espera el backend (`route` empieza con `/`). */
export function currentHelpRoute(url: string): string {
  const path = url.split(/[?#]/)[0] || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}
