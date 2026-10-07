import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { AuthService } from 'src/app/modules/auth/pages/data-access';
import { isSupportUrl, SUPPORT_HOME, SupportModeService } from '../services/support-mode';
import { WhoamiDto } from '../services/whoami/dtos';
import {
  isSuperAdmin,
  isSuperAdminUrl,
  needsLocationStep,
  SUPERADMIN_HOME,
  WhoamiService,
} from '../services/whoami/whoami.service';

// Con sesión pero sin negocio, o dueño sin ningún local activo → onboarding (sin negocio el backend responde 403 en casi todo).
// Si whoami no trae locationsCount (respuesta antigua), solo se exige el negocio.
// Excepción: el equipo de Redom (SUPERADMIN) no gestiona negocios: solo usa la plataforma, el centro de ayuda y su
// perfil. Cualquier pantalla del restaurante lo lleva a Plataforma (tenga o no negocio).
export const businessGuard: CanActivateFn = (_route, state) => {
  if (!inject(AuthService).isLogin()) return true; // authGuard de cada ruta se encarga.
  const router = inject(Router);
  const whoamiService = inject(WhoamiService);
  const support = inject(SupportModeService);
  const allow = (whoami: WhoamiDto) => {
    if (isSuperAdmin(whoami)) {
      // En modo soporte también puede abrir la carta del negocio que lo autorizó.
      if (support.$active() && isSupportUrl(state.url)) return true;
      return isSuperAdminUrl(state.url) ? true : router.parseUrl(support.$active() ? SUPPORT_HOME : SUPERADMIN_HOME);
    }
    return !whoami.user.restaurantId || needsLocationStep(whoami) === true ? router.parseUrl('/onboarding') : true;
  };
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
  return whoamiService.load().pipe(
    switchMap((whoami) =>
      // El SUPERADMIN no crea negocios: va a Plataforma.
      whoami && isSuperAdmin(whoami)
        ? of(router.parseUrl(SUPERADMIN_HOME))
        : whoamiService.needsOnboarding(whoami).pipe(map((pending) => (pending ? true : dashboard))),
    ),
  );
};
