import { computed, inject, Signal } from '@angular/core';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { FindMyBusinessesService } from './find-my-businesses.service';

/** Campos de la configuración que solo cambia el dueño (el backend responde 403 OWNER_ONLY_SETTING). */
export const OWNER_ONLY_SETTING_LABELS: Readonly<Record<string, string>> = {
  name: 'nombre',
  taxNumber1: 'RUT',
  taxLabel1: 'etiqueta tributaria',
  taxNumber2: 'segundo dato tributario',
  taxLabel2: 'segunda etiqueta tributaria',
  currencyId: 'moneda',
};

export const OWNER_ONLY_SETTING_NOTE = 'Solo el dueño puede cambiar el nombre, los datos tributarios y la moneda.';

/** true si el usuario actual es el dueño del negocio activo (isOwner del backend; si no viene, ownerId === su código). */
export function injectIsBusinessOwner(): Signal<boolean> {
  const whoami = inject(WhoamiService);
  const businesses = inject(FindMyBusinessesService);
  return computed(() => {
    const code = whoami.$whoami()?.user.code;
    const business = businesses.$current();
    if (!business) return false;
    return business.isOwner ?? (!!code && business.ownerId === code);
  });
}
