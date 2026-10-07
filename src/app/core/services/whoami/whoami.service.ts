import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  catchError,
  debounceTime,
  EMPTY,
  filter,
  fromEvent,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  Subject,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { WhoamiDto } from './dtos';

const MINUTE = 60_000;

const isOwner = (whoami: WhoamiDto) => whoami.roles.some((role) => role.code === 'OWNER');

/**
 * Con negocio: ¿falta el paso "Tu local"? undefined si whoami no trae locationsCount (hay que consultar los locales).
 */
export function needsLocationStep(whoami: WhoamiDto): boolean | undefined {
  if (!isOwner(whoami)) return false;
  const count = whoami.user.locationsCount;
  return typeof count === 'number' ? count === 0 : undefined;
}

export type SessionUser = Readonly<{
  code: string;
  name: string;
  fatherLastName: string;
  motherLastName: string | null;
  email: string;
  profileImageUrl?: string | null;
}>;

@Injectable({ providedIn: 'root' })
export class WhoamiService implements OnDestroy {
  readonly #httpClient = inject(HttpClient);
  readonly #destroy$ = new Subject<void>();
  readonly #fetchUser$ = new BehaviorSubject<void>(void 0);

  readonly #user$: Observable<WhoamiDto | null> = merge(
    this.#fetchUser$,
    timer(0, MINUTE).pipe(filter(() => document.hasFocus())),
    fromEvent(document, 'visibilitychange').pipe(
      filter(() => document.visibilityState === 'visible' && document.hasFocus()),
      debounceTime(30_000),
    ),
  ).pipe(
    switchMap(() =>
      this.#httpClient.get<WhoamiDto>(`${ApiPathEnum.AUTH}/users/whoami`).pipe(
        tap((whoami) => this.#latest.set(whoami)),
        catchError(() => EMPTY),
        tap(() => localStorage.setItem('lastActivity', String(Date.now()))),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
    takeUntil(this.#destroy$),
  );

  // Última respuesta de whoami, venga del refresco periódico o de load(); se borra al cerrar sesión.
  readonly #latest = signal<WhoamiDto | undefined>(undefined);
  readonly $whoami = this.#latest.asReadonly();
  readonly roles$: Observable<Set<string>> = this.#user$.pipe(map((u) => new Set(u?.roles.map((r) => r.code) ?? [])));
  readonly permissions$: Observable<Set<string>> = this.#user$.pipe(map((u) => new Set(u?.permissions ?? [])));
  readonly $permissionsSet = toSignal(this.permissions$, { initialValue: new Set<string>() });
  // Sucursal asignada al usuario (null si no tiene); undefined mientras carga.
  readonly $branchId = computed(() => {
    const whoami = this.$whoami();
    return whoami === undefined ? undefined : whoami?.user.branchId || null;
  });

  constructor() {
    this.#user$.subscribe();
  }

  refetch() {
    this.#fetchUser$.next();
  }

  /**
   * Pide whoami ahora mismo (null si falla). Es la fuente de verdad del restaurantId:
   * no se usa el del JWT porque cambia al crear el negocio.
   */
  load(): Observable<WhoamiDto | null> {
    return this.#httpClient.get<WhoamiDto>(`${ApiPathEnum.AUTH}/users/whoami`).pipe(
      tap((whoami) => this.#latest.set(whoami)),
      catchError(() => of(null)),
    );
  }

  /**
   * ¿Le falta el onboarding? Sin negocio → desde "Tu negocio"; dueño con negocio y 0 locales activos → "Tu local".
   * Quien no es dueño nunca va al onboarding (no puede crear locales).
   * Respuestas antiguas sin locationsCount: se consultan los locales; si falla, no se bloquea la entrada a la app.
   */
  needsOnboarding(whoami: WhoamiDto | null): Observable<boolean> {
    if (!whoami?.user.restaurantId) return of(true);
    const known = needsLocationStep(whoami);
    if (known !== undefined) return of(known);
    return this.#httpClient.get<unknown[]>(`${ApiPathEnum.RESTAURANT}/business-locations`).pipe(
      map((locations) => locations.length === 0),
      catchError(() => of(false)),
    );
  }

  // Adónde ir después de iniciar sesión: sin negocio o sin local → onboarding.
  homeRoute(): Observable<string> {
    return this.load().pipe(
      switchMap((whoami) => this.needsOnboarding(whoami)),
      map((pending) => (pending ? '/onboarding' : '/dashboard/admin')),
    );
  }

  forget() {
    this.#latest.set(undefined);
    this.#sessionUser.set(null);
  }

  /** Datos del login, solo en memoria, para el header mientras llega whoami. */
  readonly #sessionUser = signal<SessionUser | null>(null);

  /** Usuario para el header/menú: whoami si ya cargó; si no, lo que trajo el login. */
  readonly $currentUser = computed<SessionUser | null>(() => this.$whoami()?.user ?? this.#sessionUser());

  seedFromSession(user: SessionUser) {
    this.#sessionUser.set(user);
  }

  /** Refleja un cambio propio (foto, nombre) al instante, sin esperar al próximo whoami. */
  patchUser(changes: Partial<WhoamiDto['user']>) {
    const current = this.#latest();
    if (current) this.#latest.set({ ...current, user: { ...current.user, ...changes } });
    const session = this.#sessionUser();
    if (session) this.#sessionUser.set({ ...session, ...changes });
  }

  ngOnDestroy() {
    this.#destroy$.next();
    this.#destroy$.complete();
  }
}
