import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { PublicLocationMenuDto } from '../../data-access/dtos/public-menu.dto';
import { PublicMenuApiService, TABLE_QR_PATTERN } from '../../data-access/public-menu-api.service';
import { CartaAnalytics } from '../carta-analytics';
import { CARTA_BASE_PATH, CartaLoadError, readCartaError, saveTableQr } from '../carta-utils';
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
      <app-carta-menu-view [menu]="s.menu" [qr]="qr()" (refresh)="load(true)" />
    } @else if (s.error.kind === 'rate-limited') {
      <app-carta-retry (retry)="load()" />
    } @else if (s.error.kind === 'error') {
      <app-carta-retry [message]="s.error.offline ? 'No hay conexión. Revisa tu internet' : 'No pudimos cargar la carta'" [delay]="0" (retry)="load()" />
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

  protected readonly state = signal<State>({ status: 'loading' });
  protected readonly qr = signal<string | null>(null);

  #business = '';
  #location = '';
  #qr: string | null = null;
  #request: Subscription | null = null;

  constructor() {
    combineLatest([this.#route.paramMap, this.#route.queryParamMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([params, query]) => {
        const qr = query.get('qr')?.toLowerCase() ?? null;
        const business = params.get('business') ?? '';
        const location = params.get('location') ?? '';
        const validQr = qr && TABLE_QR_PATTERN.test(qr) ? qr : null;
        if (business === this.#business && location === this.#location && validQr === this.#qr && this.state().status !== 'error') return;
        this.#business = business;
        this.#location = location;
        this.#qr = validQr;
        this.qr.set(validQr);
        if (validQr) saveTableQr(validQr);
        this.load();
      });
    inject(DestroyRef).onDestroy(() => this.#request?.unsubscribe());
  }

  /** silent: recarga sin esqueleto ni menu_view (p. ej. tras PRODUCT_UNAVAILABLE); si falla, se queda la carta actual. */
  load(silent = false): void {
    silent &&= this.state().status === 'ready';
    this.#request?.unsubscribe();
    if (!silent) this.state.set({ status: 'loading' });
    this.#request = this.#api.getLocationMenu(this.#business, this.#location, this.#qr).subscribe({
      next: (menu) => {
        this.#setMeta(menu);
        this.state.set({ status: 'ready', menu });
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
          void this.#router.navigateByUrl(tree, { replaceUrl: true });
          return;
        }
        this.state.set({ status: 'error', error });
      },
    });
  }

  #setMeta(menu: PublicLocationMenuDto): void {
    const title = `${menu.business.name} – ${menu.location.name} | Carta`;
    const description = menu.location.description?.trim() || `Revisa la carta de ${menu.business.name} en ${menu.location.name}.`;
    this.#title.setTitle(title);
    this.#meta.updateTag({ name: 'description', content: description });
    this.#meta.updateTag({ property: 'og:title', content: title });
    this.#meta.updateTag({ property: 'og:description', content: description });
    if (typeof location !== 'undefined') this.#meta.updateTag({ property: 'og:url', content: location.origin + location.pathname });
    if (menu.business.logoUrl) this.#meta.updateTag({ property: 'og:image', content: menu.business.logoUrl });
    else this.#meta.removeTag('property="og:image"');
  }
}
