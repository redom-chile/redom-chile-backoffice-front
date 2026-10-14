import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PublicBusinessMenusDto } from '../../data-access/dtos/public-menu.dto';
import { PublicMenuApiService, TABLE_QR_PATTERN } from '../../data-access/public-menu-api.service';
import { CARTA_BASE_PATH, CartaLoadError, initials, readCartaError, saveTableQr } from '../carta-utils';
import { CartaIcon } from '../ui/carta-icon';
import { CartaRetry, CartaSkeleton, CartaUnavailable } from '../ui/carta-states';

type State =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; data: PublicBusinessMenusDto }>
  | Readonly<{ status: 'error'; error: CartaLoadError }>;

/**
 * /carta/{negocio}: con un local entra directo; con varios, selector.
 * /carta/{qr} (32 hex): resuelve la mesa y abre /carta/{negocio}/{local}?qr=…
 */
@Component({
  selector: 'app-carta-business-page',
  imports: [RouterLink, CartaIcon, CartaRetry, CartaSkeleton, CartaUnavailable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = state();
    @switch (s.status) {
      @case ('loading') {
        <app-carta-skeleton />
      }
      @case ('error') {
        @if (s.status === 'error') {
          @switch (s.error.kind) {
            @case ('rate-limited') {
              <app-carta-retry (retry)="load()" />
            }
            @case ('error') {
              <app-carta-retry
                [message]="s.error.kind === 'error' && s.error.offline ? 'No hay conexión. Revisa tu internet' : 'No pudimos cargar la carta'"
                [delay]="0"
                (retry)="load()"
              />
            }
            @default {
              <app-carta-unavailable />
            }
          }
        }
      }
      @case ('ready') {
        @if (s.status === 'ready') {
          <div class="relative min-h-dvh bg-background text-foreground antialiased">
            <div class="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/15 to-transparent" aria-hidden="true"></div>
            <main class="relative mx-auto max-w-2xl px-4 pb-12 pt-10">
              <div class="flex flex-col items-center text-center">
                @if (s.data.business.logoUrl && !logoFailed()) {
                  <img
                    [src]="s.data.business.logoUrl"
                    [alt]="'Logo de ' + s.data.business.name"
                    width="80"
                    height="80"
                    class="size-20 rounded-2xl bg-card object-cover shadow-sm ring-1 ring-border"
                    (error)="logoFailed.set(true)"
                  />
                } @else {
                  <span class="flex size-20 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground" aria-hidden="true">{{
                    initialsOf(s.data.business.name)
                  }}</span>
                }
                <h1 class="mt-4 text-2xl font-bold tracking-tight [overflow-wrap:anywhere]">{{ s.data.business.name }}</h1>
                <p class="mt-1 text-muted-foreground">Elige un local para ver su carta</p>
              </div>
              <ul class="mt-8 grid gap-3">
                @for (l of s.data.locations; track l.slug) {
                  <li>
                    <a
                      [routerLink]="[basePath, s.data.business.slug, l.slug]"
                      class="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.99]"
                    >
                      <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-border">
                        <app-carta-icon name="store" [size]="20" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block font-semibold [overflow-wrap:anywhere]">{{ l.name }}</span>
                        @if (l.address) {
                          <span class="mt-0.5 block text-sm text-muted-foreground [overflow-wrap:anywhere]">{{ l.address }}</span>
                        }
                        <span
                          class="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold"
                          [class]="l.isOpenNow ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'"
                        >
                          <span class="size-2 rounded-full" [class]="l.isOpenNow ? 'bg-emerald-500' : 'bg-muted-foreground'" aria-hidden="true"></span>
                          {{ l.isOpenNow ? 'Abierto ahora' : 'Cerrado' }}
                        </span>
                      </span>
                      <app-carta-icon name="chevron-down" [size]="18" class="-rotate-90 text-muted-foreground" />
                    </a>
                  </li>
                }
              </ul>
              @if (s.data.business.showRedomBadge) {
                <p class="mt-10 text-center text-sm text-muted-foreground">
                  <a href="https://redom.cl" target="_blank" rel="noopener" class="hover:text-foreground">Hecha con <strong class="font-semibold text-foreground">Redom</strong></a>
                </p>
              }
            </main>
          </div>
        }
      }
    }
  `,
})
export class CartaBusinessPage {
  readonly #api = inject(PublicMenuApiService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #title = inject(Title);
  readonly #meta = inject(Meta);
  protected readonly basePath = inject(CARTA_BASE_PATH);

  protected readonly state = signal<State>({ status: 'loading' });
  protected readonly logoFailed = signal(false);
  protected readonly initialsOf = initials;

  #slug = '';
  #request: Subscription | null = null;

  constructor() {
    this.#route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.#slug = params.get('slug') ?? '';
      this.load();
    });
    inject(DestroyRef).onDestroy(() => this.#request?.unsubscribe());
  }

  load(): void {
    this.#request?.unsubscribe();
    this.state.set({ status: 'loading' });
    const slug = this.#slug;
    const qr = slug.toLowerCase();
    if (TABLE_QR_PATTERN.test(qr)) {
      this.#request = this.#api.getTable(qr).subscribe({
        next: (t) => {
          saveTableQr(qr);
          void this.#router.navigate([this.basePath, t.businessSlug, t.locationSlug], { queryParams: { qr }, replaceUrl: true });
        },
        error: (e) => this.#fail(e),
      });
      return;
    }
    this.#request = this.#api.getBusinessMenus(slug).subscribe({
      next: (data) => {
        if (data.locations.length === 1) {
          void this.#router.navigate([this.basePath, data.business.slug, data.locations[0].slug], { replaceUrl: true });
          return;
        }
        if (!data.locations.length) {
          this.state.set({ status: 'error', error: { kind: 'not-found' } });
          return;
        }
        this.#title.setTitle(`${data.business.name} | Carta`);
        this.#meta.updateTag({ property: 'og:title', content: `${data.business.name} | Carta` });
        if (data.business.logoUrl) this.#meta.updateTag({ property: 'og:image', content: data.business.logoUrl });
        this.state.set({ status: 'ready', data });
      },
      error: (e) => this.#fail(e),
    });
  }

  #fail(e: unknown): void {
    const error = readCartaError(e, this.basePath);
    if (error.kind === 'moved') {
      void this.#router.navigateByUrl(error.path, { replaceUrl: true });
      return;
    }
    this.state.set({ status: 'error', error });
  }
}
