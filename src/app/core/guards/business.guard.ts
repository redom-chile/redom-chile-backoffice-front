import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AuthService } from 'src/app/modules/auth/pages/data-access';
import { WhoamiDto } from '../services/whoami/dtos';
import { needsLocationStep, WhoamiService } from '../services/whoami/whoami.service';

// Con sesión pero sin negocio, o dueño sin ningún local activo → onboarding (sin negocio el backend responde 403 en casi todo).
// Si whoami no trae locationsCount (respuesta antigua), solo se exige el negocio.
export const businessGuard: CanActivateFn = () => {
  if (!inject(AuthService).isLogin()) return true; // authGuard de cada ruta se encarga.
  const router = inject(Router);
  const whoamiService = inject(WhoamiService);
  const allow = (whoami: WhoamiDto) =>
    !whoami.user.restaurantId || needsLocationStep(whoami) === true ? router.parseUrl('/onboarding') : true;
  const known = whoamiService.$whoami();
  if (known) return allow(known);
  return whoamiService.load().pipe(map((whoami) => (whoami ? allow(whoami) : true)));
};

// El onboarding es para quien aún no tiene negocio, o para el dueño con negocio pero sin locales activos:
// ahí la página retoma en el paso "Tu local".
export const onboardingGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!inject(AuthService).isLogin()) return router.parseUrl('/auth/sign-in');
  const dashboard = router.parseUrl('/dashboard/admin');
  const whoamiService = inject(WhoamiService);
  return whoamiService
    .load()
    .pipe(
      switchMap((whoami) => whoamiService.needsOnboarding(whoami)),
      map((pending) => (pending ? true : dashboard)),
    );
};
