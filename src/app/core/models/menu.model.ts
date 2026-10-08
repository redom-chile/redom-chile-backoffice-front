export interface MenuItem {
  group: string;
  separator?: boolean;
  selected?: boolean;
  active?: boolean;
  items: Array<SubMenuItem>;
}

export interface SubMenuItem {
  icon?: string;
  label?: string;
  route?: string | null;
  expanded?: boolean;
  active?: boolean;
  children?: Array<SubMenuItem>;
  permission?: string;
  /** Solo se muestra si la función está activa en la configuración del negocio. */
  feature?: 'inventory' | 'ingredients' | 'multiLocation';
  /** Solo se muestra a quien tiene ese rol (roles[].code de whoami), aunque los permisos estén apagados. */
  role?: string;
  /** Lo calcula el MenuService: el plan del negocio no incluye esta pantalla (se muestra con candado). */
  locked?: boolean;
}
