import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from 'src/app/modules/auth/pages/data-access';
import { ApiPathEnum } from 'src/environments';
import { ToastService } from 'src/ui';

// Endpoints públicos: su 401 significa "credenciales inválidas", no "token vencido" (logout sí lleva token).
const PUBLIC_PATHS = [
  `${ApiPathEnum.AUTH}/login/`,
  `${ApiPathEnum.AUTH}/auth/refresh-token`,
  `${ApiPathEnum.AUTH}/auth/forgot-password`,
];
const isPublic = (url: string) => PUBLIC_PATHS.some((path) => url.startsWith(path)) && !url.endsWith('/login/logout');

let lastSessionEnd = 0;

const withToken = (req: HttpRequest<unknown>, token: string) =>
  req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const token = authService.getToken();

  if (!token || isPublic(req.url)) return next(req);

  const endSession = () => {
    authService.clearSession();
    // Varias peticiones pueden fallar a la vez: un solo aviso y una sola redirección.
    if (Date.now() - lastSessionEnd < 3000 || router.url.startsWith('/auth')) return;
    lastSessionEnd = Date.now();
    toast.show('Tu sesión expiró. Inicia sesión nuevamente.', 'warning');
    router.navigate(['/auth/sign-in']);
  };

  return next(withToken(req, token)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) return throwError(() => error);
      // Refresh con cola: si ya hay uno en curso, se espera ese mismo.
      return authService.refreshAccessToken().pipe(
        catchError((refreshError) => {
          endSession();
          return throwError(() => (refreshError instanceof HttpErrorResponse ? error : refreshError));
        }),
        switchMap((newToken) =>
          next(withToken(req, newToken)).pipe(
            // Un 401 con el token recién renovado: la sesión ya no sirve (revocada o token no registrado).
            catchError((retryError: HttpErrorResponse) => {
              if (retryError.status === 401) endSession();
              return throwError(() => retryError);
            }),
          ),
        ),
      );
    }),
  );
};
