import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, Observable, of } from 'rxjs';
import { WhoamiService } from '../whoami/whoami.service';
import { EntitlementsService } from './entitlements.service';
import { PlanUpsellService } from './plan-upsell.service';
import { planFeaturesForUrl } from './plan-routes';

/**
 * Si el plan no incluye la función de la pantalla, muestra el modal para mejorar el plan en vez de entrar.
 * Al abrir por URL directa (sin pantalla previa) lleva al Resumen y muestra el modal ahí.
 */
export const planFeatureGuard: CanActivateFn = (_route, state): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const features = planFeaturesForUrl(state.url);
  if (!features.length) return true;
  const entitlements = inject(EntitlementsService);
  const router = inject(Router);
  const upsell = inject(PlanUpsellService);
  const whoami = inject(WhoamiService);

  const decide = (): boolean | UrlTree => {
    const missing = features.filter((code) => !entitlements.hasFeature(code));
    if (!missing.length) return true;
    upsell.open({ features: missing });
    return router.navigated ? false : router.parseUrl('/dashboard/admin');
  };
  // Los entitlements llegan con whoami: se espera la primera respuesta.
  if (whoami.$whoami() !== undefined) return decide();
  return whoami.load().pipe(map(() => decide()));
};
