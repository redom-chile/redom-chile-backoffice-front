import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, Observable } from 'rxjs';
import { Menu } from '../constants/menu';
import { SubMenuItem } from '../models/menu.model';
import { AccessService, permissionForUrl } from '../permissions';
import { WhoamiService } from '../services/whoami/whoami.service';
import { ToastService } from 'src/ui';

/** Pantalla sin permiso: siempre se puede entrar (cualquier usuario con sesión). */
const ALWAYS_ALLOWED = '/profile';
/** Pantallas fuera de la app (login, onboarding): al salir de ellas no hay "pantalla anterior" donde quedarse. */
const OUTSIDE_APP = ['/auth', '/onboarding'];

const isOutsideApp = (url: string) => url === '/' || OUTSIDE_APP.some((prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`));

/**
 * Sin el `see-module` de la pantalla (permission-routes.ts) no se entra. Desde otra pantalla de la app se queda donde está;
 * al abrir por URL directa, o al llegar desde el login o el onboarding, lleva a la primera pantalla del menú que sí puede ver.
 */
export const permissionGuard: CanActivateFn = (_route, state): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const permission = permissionForUrl(state.url);
  if (!permission) return true;
  const access = inject(AccessService);
  const router = inject(Router);
  const whoami = inject(WhoamiService);
  const toast = inject(ToastService);

  const decide = (): boolean | UrlTree => {
    if (access.can(permission)) return true;
    if (router.navigated && !isOutsideApp(router.url)) {
      toast.show('No tienes permiso para ver esta pantalla.', 'error');
      return false;
    }
    return router.parseUrl(firstAllowedRoute(access));
  };
  // Los permisos llegan con whoami: se espera la primera respuesta.
  if (whoami.$whoami() !== undefined) return decide();
  return whoami.load().pipe(map(() => decide()));
};

function firstAllowedRoute(access: AccessService): string {
  const roles = new Set(access.$isSuperAdmin() ? ['SUPERADMIN'] : []);
  const routes = Menu.pages
    .flatMap((group) => group.items)
    .flatMap((item): SubMenuItem[] => (item.children?.length ? item.children : [item]))
    .filter((item) => !item.role || roles.has(item.role))
    .map((item) => item.route)
    .filter((route): route is string => !!route);
  // Solo pantallas del negocio (con permiso): el menú todavía trae ítems de la plantilla (Errors, Components…).
  return (
    routes.find((route) => {
      const permission = permissionForUrl(route);
      return !!permission && access.can(permission);
    }) ?? ALWAYS_ALLOWED
  );
}
