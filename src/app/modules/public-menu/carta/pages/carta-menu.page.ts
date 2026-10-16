import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { PublicLocationMenuDto } from '../../data-access/dtos/public-menu.dto';
import { PublicMenuApiService, TABLE_QR_PATTERN } from '../../data-access/public-menu-api.service';
import { CartaAnalytics } from '../carta-analytics';
import { CartaEmbed } from '../carta-embed';
import { CartaDisplay } from '../carta-display';
import { CartaI18n, CartaLang, ct } from '../carta-i18n';
import { CARTA_BASE_PATH, CartaLoadError, readCartaError } from '../carta-utils';
import { CartaMenuView } from '../ui/carta-menu-view';
import { CartaRetry, CartaSkeleton, CartaUnavailable } from '../ui/carta-states';

type State =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; menu: PublicLocationMenuDto }>
  | Readonly<{ status: 'error'; error: CartaLoadError }>;

/** /carta/{negocio}/{local}[?qr=…]: la carta del local; con qr, con la mesa (aunque no esté publicada). */
@Component({
  selector: 'app-carta-menu-page',
  imports: [CartaMenuView, CartaRetry, CartaSkeleton, CartaUnavailable],
  providers: [CartaAnalytics],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = state();
    @if (s.status === 'loading') {
      <app-carta-skeleton />
    } @else if (s.status === 'ready') {
      <app-carta-menu-view [menu]="s.menu" [qr]="qr()" (refresh)="load(true)" (languageChange)="changeLanguage($event)" />
    } @else if (s.error.kind === 'rate-limited') {
      <app-carta-retry (retry)="load()" />
    } @else if (s.error.kind === 'error') {
      <app-carta-retry [message]="t(s.error.offline ? 'state.offline' : 'state.loadFailed')" [delay]="0" (retry)="load()" />
    } @else {
      <app-carta-unavailable />
    }
  `,
})
export class CartaMenuPage {
  readonly #api = inject(PublicMenuApiService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #title = inject(Title);
  readonly #meta = inject(Meta);
  readonly #basePath = inject(CARTA_BASE_PATH);
  readonly #analytics = inject(CartaAnalytics);
  readonly #embed = inject(CartaEmbed);
  readonly #i18n = inject(CartaI18n);
  protected readonly t = this.#i18n.t;

  protected readonly state = signal<State>({ status: 'loading' });
  protected readonly qr = signal<string | null>(null);

  #business = '';
  #location = '';
  #qr: string | null = null;
  /** Idioma pedido al backend (null: Accept-Language). */
  #lang: CartaLang | null = null;
  #request: Subscription | null = null;

  constructor() {
    inject(CartaDisplay).activate();
    this.#i18n.activate();
    combineLatest([this.#route.paramMap, this.#route.queryParamMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([params, query]) => {
        const qr = query.get('qr')?.toLowerCase() ?? null;
        const business = params.get('business') ?? '';
        const location = params.get('location') ?? '';
        const validQr = qr && TABLE_QR_PATTERN.test(qr) ? qr : null;
        const lang = this.#i18n.menuRequest(query.get('lang'));
        const same = business === this.#business && location === this.#location && validQr === this.#qr;
        if (same && lang === this.#lang && this.state().status !== 'error') return;
        // Solo cambió el idioma: recarga sin esqueleto (se mantienen el carrito y la posición)
        const silent = same && this.state().status === 'ready';
        this.#lang = lang;
        this.#business = business;
        this.#location = location;
        this.#qr = validQr;
        this.qr.set(validQr);
        this.load(silent);
      });
    inject(DestroyRef).onDestroy(() => this.#request?.unsubscribe());
  }

  /** silent: recarga sin esqueleto ni menu_view (p. ej. tras PRODUCT_UNAVAILABLE); si falla, se queda la carta actual. */
  load(silent = false): void {
    silent &&= this.state().status === 'ready';
    this.#request?.unsubscribe();
    if (!silent) this.state.set({ status: 'loading' });
    this.#request = this.#api.getLocationMenu(this.#business, this.#location, this.#qr, this.#lang).subscribe({
      next: (menu) => {
        this.#i18n.useMenuLanguage(menu.language);
        this.#setMeta(menu);
        this.state.set({ status: 'ready', menu });
        this.#keepLangInUrl();
        if (silent) return;
        this.#analytics.start(menu.business.slug, menu.location.slug);
        this.#analytics.track('menu_view');
      },
      error: (e) => {
        if (silent) return;
        const error = readCartaError(e, this.#basePath);
        if (error.kind === 'moved') {
          const tree = this.#router.parseUrl(error.path);
          if (this.#qr) tree.queryParams = { ...tree.queryParams, qr: this.#qr };
          void this.#router.navigateByUrl(this.#embed.withParams(tree), { replaceUrl: true });
          return;
        }
        this.state.set({ status: 'error', error });
      },
    });
  }

  /** Guarda la elección y la deja en la URL; el cambio de ?lang= recarga la carta. */
  protected changeLanguage(lang: CartaLang): void {
    this.#i18n.choose(lang);
    void this.#router.navigate([], { relativeTo: this.#route, queryParams: { lang }, queryParamsHandling: 'merge', replaceUrl: true, preserveFragment: true });
  }

  /** Idioma guardado (no venía en la URL): se agrega ?lang= para que se mantenga al compartir o navegar. */
  #keepLangInUrl(): void {
    const lang = this.#lang;
    if (!lang || typeof location === 'undefined' || this.#route.snapshot.queryParamMap.get('lang') === lang) return;
    this.#i18n.requested.set(lang);
    void this.#router.navigate([], { relativeTo: this.#route, queryParams: { lang }, queryParamsHandling: 'merge', replaceUrl: true, preserveFragment: true });
  }

  #setMeta(menu: PublicLocationMenuDto): void {
    const names = { business: menu.business.name, location: menu.location.name };
    const title = ct('page.title', names);
    const description = menu.location.description?.trim() || ct('page.description', names);
    this.#title.setTitle(title);
    this.#meta.updateTag({ name: 'description', content: description });
    this.#meta.updateTag({ property: 'og:title', content: title });
    this.#meta.updateTag({ property: 'og:description', content: description });
    if (typeof location !== 'undefined') this.#meta.updateTag({ property: 'og:url', content: location.origin + location.pathname });
    if (menu.business.logoUrl) this.#meta.updateTag({ property: 'og:image', content: menu.business.logoUrl });
    else this.#meta.removeTag('property="og:image"');
  }
}
