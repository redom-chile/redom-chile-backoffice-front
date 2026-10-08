import { Injectable, inject, Injector } from '@angular/core';
import { BehaviorSubject, catchError, finalize, map, Observable, of, shareReplay, Subject, switchMap, tap, throwError } from 'rxjs';
import {
  GoogleSessionDto,
  LoginInputDto,
  LoginOutputDto,
  RegisterOwnerDto,
  RegisterOwnerResponseDto,
  SessionDto,
  UserDataDto,
} from '../dtos';
import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiPathEnum } from 'src/environments';
import { environment } from 'src/environments/environment';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  tokenKey = 'token';
  refreshTokenKey = 'refreshToken';
  private userDataKey = 'userData';
  private lastActivityKey = 'lastActivity';

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();

  readonly $isLoading = toSignal(this.#isLoading$, { initialValue: false });
  readonly $error = toSignal(this.#error$);
  readonly $hasError = toSignal(this.#error$.pipe(map((code) => code !== undefined)));

  token: string | null = null;
  refreshToken: string | null = null;
  currentUserLoginOn: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  currentUserData: BehaviorSubject<LoginOutputDto> = new BehaviorSubject<Readonly<LoginOutputDto>>({
    token: { token: '' },
    refreshToken: '',
    userData: {
      code: '',
      email: '',
      fatherLastName: '',
      motherLastName: '',
      name: '',
      rut: '',
      status: '',
    },
  });

  readonly #injector = inject(Injector);
  #whoamiService: WhoamiService | null = null;

  get #whoami(): WhoamiService {
    if (!this.#whoamiService) {
      this.#whoamiService = this.#injector.get(WhoamiService);
    }
    return this.#whoamiService;
  }

  constructor(private http: HttpClient) {
    this.loadSession();
  }

  private loadSession() {
    const lastActivity = localStorage.getItem(this.lastActivityKey);

    if (lastActivity) {
      const elapsed = Date.now() - Number(lastActivity);
      const oneDay = 24 * 60 * 60 * 1000;

      if (elapsed > oneDay) {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.refreshTokenKey);
        localStorage.removeItem(this.userDataKey);
        localStorage.removeItem(this.lastActivityKey);
        return;
      }
    }

    const storedToken = localStorage.getItem(this.tokenKey);
    const storedRefreshToken = localStorage.getItem(this.refreshTokenKey);
    const storedUserData = localStorage.getItem(this.userDataKey);

    if (storedToken) {
      this.token = storedToken;
      this.refreshToken = storedRefreshToken;
      this.currentUserLoginOn.next(true);

      if (storedUserData) {
        try {
          const userData: UserDataDto = JSON.parse(storedUserData);
          this.currentUserData.next({
            token: { token: storedToken },
            refreshToken: storedRefreshToken ?? '',
            userData,
          });
        } catch (error) {
          console.error('Error al parsear userData desde localStorage:', error);
        }
      }
    }
  }

  private saveToken(token: string) {
    localStorage.setItem(this.tokenKey, token);
    this.token = token;
  }

  private saveRefreshToken(refreshToken: string) {
    localStorage.setItem(this.refreshTokenKey, refreshToken);
    this.refreshToken = refreshToken;
  }

  getToken(): string | null {
    return this.token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  login(loginInput: LoginInputDto): Observable<SessionDto> {
    this.#isLoading$.next(true);

    return this.http
      .post<SessionDto>(
        `${ApiPathEnum.AUTH}/login/authenticate-user`,
        {
          email: loginInput.email,
          password: loginInput.password,
        },
      )
      .pipe(
        tap(() => this.#isLoading$.next(true)),
        tap(() => this.#error$.next(undefined)),
        catchError((error: HttpErrorResponse) => {
          this.#error$.next(error.status);
          this.#isLoading$.next(false);
          return throwError(() => error);
        }),
        tap((response) => this.startSession(response)),
        finalize(() => {
          this.#isLoading$.next(false);
        }),
      );
  }

  logout(): Observable<void> {
    this.#isLoading$.next(true);

    return this.http.post<void>(`${ApiPathEnum.AUTH}/login/logout`, {}).pipe(
      tap(() => this.#error$.next(undefined)),
      catchError((error: HttpErrorResponse) => {
        let errorMessage = '';
        if (error.error instanceof ErrorEvent) {
          errorMessage = `Error ${error.error.message}`;
        } else {
          errorMessage = `Error code: ${error.status}, message: ${error.message}`;
        }
        this.#error$.next(error.status);
        return throwError(() => errorMessage);
      }),
      finalize(() => {
        this.#isLoading$.next(false);
        this.clearSession();
      }),
    );
  }

  // Un solo refresh a la vez: las peticiones que reciben 401 en paralelo esperan este mismo resultado.
  #refreshInFlight$: Observable<string> | null = null;

  refreshAccessToken(): Observable<string> {
    const currentRefreshToken = this.getRefreshToken();
    if (!currentRefreshToken) {
      this.clearSession();
      return throwError(() => new Error('No refresh token available'));
    }
    if (this.#refreshInFlight$) return this.#refreshInFlight$;

    this.#refreshInFlight$ = this.http
      .post<{ accessToken: string; refreshToken: string }>(`${ApiPathEnum.AUTH}/auth/refresh-token`, {
        refreshToken: currentRefreshToken,
      })
      .pipe(
        // El refresh token rota: se reemplazan ambos.
        tap((response) => {
          this.saveToken(response.accessToken);
          this.saveRefreshToken(response.refreshToken);
          localStorage.setItem(this.lastActivityKey, String(Date.now()));
        }),
        map((response) => response.accessToken),
        catchError((error: HttpErrorResponse) => {
          this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => (this.#refreshInFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.#refreshInFlight$;
  }

  // --- Registro, verificación y Google ---

  register(input: RegisterOwnerDto): Observable<RegisterOwnerResponseDto> {
    return this.http.post<RegisterOwnerResponseDto>(`${ApiPathEnum.AUTH}/login/register`, input);
  }

  verifyEmail(email: string, code: string): Observable<SessionDto> {
    return this.http
      .post<SessionDto>(`${ApiPathEnum.AUTH}/login/verify-email`, { email, code })
      .pipe(tap((session) => this.startSession(session)));
  }

  // Siempre responde 200; el backend ignora reenvíos antes de 1 minuto.
  resendVerificationEmail(email: string): Observable<unknown> {
    return this.http.post(`${ApiPathEnum.AUTH}/login/resend-verification-email`, { email });
  }

  loginWithGoogle(idToken: string): Observable<GoogleSessionDto> {
    return this.http
      .post<GoogleSessionDto>(`${ApiPathEnum.AUTH}/login/google`, { idToken })
      .pipe(tap((session) => this.startSession(session)));
  }

  // --- Recuperar contraseña / activar invitación (mismo flujo) ---

  // Siempre responde 200 (no revela si el email existe) y envía un código temporal por correo.
  forgotPassword(email: string): Observable<unknown> {
    return this.http.post(`${ApiPathEnum.AUTH}/auth/forgot-password`, { email });
  }

  // Con el código temporal del correo define la contraseña y deja la cuenta ACTIVA.
  resetPassword(email: string, temporaryCode: string, newPassword: string): Observable<unknown> {
    return this.http.put(`${ApiPathEnum.AUTH}/login/reset-password`, {
      email,
      currentPassword: temporaryCode,
      newPassword,
    });
  }

  // Guarda la sesión de cualquier login y actualiza el usuario actual (whoami es la fuente de verdad).
  startSession(session: SessionDto) {
    this.saveToken(session.token);
    this.saveRefreshToken(session.refreshToken);
    const { profileImageUrl: _signedUrl, ...storableUser } = session.userData;
    localStorage.setItem(this.userDataKey, JSON.stringify(storableUser));
    this.#whoami.seedFromSession(session.userData);
    localStorage.setItem(this.lastActivityKey, String(Date.now()));
    this.currentUserLoginOn.next(true);
    this.currentUserData.next({
      token: { token: session.token },
      refreshToken: session.refreshToken,
      userData: session.userData as unknown as UserDataDto,
    });
    this.#whoami.refetch();
  }

  // Borra la sesión local (sin llamar al backend).
  clearSession() {
    this.#whoami.forget();
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userDataKey);
    localStorage.removeItem(this.lastActivityKey);
    // Conversación con el asistente del centro de ayuda (HELP_CHAT_STORAGE_KEY).
    try {
      sessionStorage.removeItem('redom.help-chat');
    } catch {
      // Sin sessionStorage no hay nada que borrar.
    }
    this.token = null;
    this.refreshToken = null;
    this.currentUserLoginOn.next(false);
    this.currentUserData.next({
      token: { token: '' },
      refreshToken: '',
      userData: { code: '', email: '', fatherLastName: '', motherLastName: '', name: '', rut: '', status: '' },
    });
  }

  hasRole(roles: string[]): Observable<boolean> {
    return this.#whoami.roles$.pipe(map((userRoles) => roles.some((role) => userRoles.has(role))));
  }

  hasPermission(permissions: string[]): Observable<boolean> {
    // Con los permisos apagados (environment.enforcePermissions) todo está permitido en el front.
    if (!environment.enforcePermissions) return of(true);
    return this.#whoami.permissions$.pipe(map((userPermissions) => permissions.some((p) => userPermissions.has(p))));
  }

  isLogin() {
    return this.token !== null;
  }

  get userData(): Observable<LoginOutputDto> {
    return this.currentUserData.asObservable();
  }

  get userLoginOn(): Observable<boolean> {
    return this.currentUserLoginOn.asObservable();
  }
}
