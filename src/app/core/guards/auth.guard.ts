import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'src/app/modules/auth/pages/data-access';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isLoggedIn = authService.isLogin();

  if (!isLoggedIn) {
    router.navigate(['/auth/sign-in']);
    return false;
  }

  if (authService.isRestricted()) return router.parseUrl('/legal/accept');

  return true;
};
