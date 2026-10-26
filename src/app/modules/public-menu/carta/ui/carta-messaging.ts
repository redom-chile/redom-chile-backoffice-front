import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, Injector, input, output, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { readApiError } from 'src/app/core/utils/api-error';
import { CartaDisplay } from '../carta-display';
import { CartaEmbed } from '../carta-embed';
import { CARTA_LANGS, CartaI18n, CartaKey, CartaLang, ct } from '../carta-i18n';
import { initials } from '../carta-utils';
import { CartaIcon } from './carta-icon';
import { CartaLanguageMenu } from './carta-language-menu';

/** Tipos de correo con nombre propio (el token trae 'campaign' o la automatización). */
const TYPE_KEYS: Readonly<Record<string, CartaKey>> = {
  postVisitSurvey: 'msg.type.postVisitSurvey',
  loyaltyRewardAvailable: 'msg.type.loyaltyRewardAvailable',
  loyaltyPointsExpiring: 'msg.type.loyaltyPointsExpiring',
  winBack: 'msg.type.winBack',
  campaign: 'msg.type.campaign',
};

/** Nombre del tipo de correo en el idioma activo. */
export const messagingTypeLabel = (type: string): string => ct(TYPE_KEYS[type] ?? 'msg.type.unknown');

/** Estado de carga de las páginas de los correos. */
export type CartaMessagingLoad<T> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'invalid' }>
  | Readonly<{ status: 'error'; offline: boolean; rateLimited: boolean }>
  | Readonly<{ status: 'ready'; data: T }>;

/** 400 MESSAGING_TOKEN_INVALID (o un 400/404 sin código: también es el enlace) → "no es válido o ya venció". */
export function readMessagingLoadError(error: unknown): CartaMessagingLoad<never> {
  const api = readApiError(error);
  if (api.code === 'MESSAGING_TOKEN_INVALID' || api.status === 400 || api.status === 404) return { status: 'invalid' };
  return { status: 'error', offline: api.status === 0, rateLimited: api.code === 'RATE_LIMITED' || api.status === 429 };
}

/**
 * Lo común de /carta/encuesta y /carta/baja: tema de la carta, idioma sin carta (?lang= > guardado > navegador > es),
 * noindex y foco en el encabezado al cambiar de estado.
 */
export abstract class CartaMessagingPage {
  protected readonly i18n = inject(CartaI18n);
  protected readonly t = this.i18n.t;
  readonly #injector = inject(Injector);
  readonly #document = inject(DOCUMENT);
  readonly #title = inject(Title);
  readonly #titleKey: CartaKey;
  #business: string | null = null;

  constructor(titleKey: CartaKey) {
    this.#titleKey = titleKey;
    inject(CartaDisplay).activate();
    this.i18n.activate();
    this.i18n.useFallback();
    this.updateTitle(null);
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex' });
    // El token va en la URL: que no viaje como referer a otros sitios (la reseña de Google, redom.cl)
    meta.updateTag({ name: 'referrer', content: 'no-referrer' });
    const embedded = inject(CartaEmbed).active;
    inject(DestroyRef).onDestroy(() => {
      meta.removeTag("name='referrer'");
      // Incrustada, toda la carta es noindex (CartaEmbed)
      if (!embedded) meta.removeTag("name='robots'");
    });
  }

  protected chooseLanguage(lang: CartaLang): void {
    this.i18n.choose(lang);
    this.i18n.useFallback();
    this.updateTitle(this.#business);
  }

  protected updateTitle(business: string | null): void {
    this.#business = business;
    const page = this.t(this.#titleKey);
    this.#title.setTitle(business ? `${page} | ${business}` : page);
  }

  /** Mueve el foco al elemento (tabindex="-1") cuando ya se pintó el estado nuevo. */
  protected focus(id: string): void {
    afterNextRender(() => (this.#document.getElementById(id) as HTMLElement | null)?.focus({ preventScroll: false }), { injector: this.#injector });
  }
}

/** Marco de las páginas de los correos: fondo de la carta, selector de idioma y pie. */
@Component({
  selector: 'app-carta-messaging-layout',
  imports: [CartaLanguageMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative flex min-h-dvh flex-col bg-background text-foreground antialiased">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/15 to-transparent" aria-hidden="true"></div>
      <app-carta-language-menu class="absolute right-4 top-4 z-30 sm:right-6 sm:top-6" [languages]="languages" (choose)="choose.emit($event)" />
      <main class="relative mx-auto w-full max-w-md flex-1 px-4 pb-10 pt-16" [attr.aria-busy]="busy() || null">
        <ng-content />
      </main>
      <footer class="relative pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
        <a href="https://redom.cl" target="_blank" rel="noopener noreferrer" class="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">redom.cl</a>
      </footer>
    </div>
  `,
})
export class CartaMessagingLayout {
  readonly busy = input(false);
  readonly choose = output<CartaLang>();
  protected readonly languages = CARTA_LANGS;
}

/** Logo (o iniciales) y nombre del negocio como encabezado de la página (h1, recibe el foco). */
@Component({
  selector: 'app-carta-messaging-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center text-center">
      @if (logoUrl() && !logoFailed()) {
        <img
          [src]="logoUrl()"
          [alt]="t('page.logoOf', { name: name() })"
          width="80"
          height="80"
          referrerpolicy="no-referrer"
          class="size-20 rounded-2xl bg-card object-cover shadow-sm ring-1 ring-border"
          (error)="logoFailed.set(true)"
        />
      } @else {
        <span class="flex size-20 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground" aria-hidden="true">{{ initialsOf(name()) }}</span>
      }
      <h1 [id]="headingId()" tabindex="-1" class="mt-4 text-2xl font-bold tracking-tight outline-none [overflow-wrap:anywhere]">{{ name() }}</h1>
      <ng-content />
    </div>
  `,
})
export class CartaMessagingHeader {
  readonly name = input.required<string>();
  readonly logoUrl = input<string | null>(null);
  readonly headingId = input.required<string>();
  protected readonly t = inject(CartaI18n).t;
  protected readonly logoFailed = signal(false);
  protected readonly initialsOf = initials;
}

/** Cargando, enlace inválido o vencido, y error con reintento. */
@Component({
  selector: 'app-carta-messaging-state',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @switch (kind()) {
      @case ('loading') {
        <div class="flex animate-pulse flex-col items-center motion-reduce:animate-none" role="status">
          <span class="sr-only">{{ t('msg.loading') }}</span>
          <div class="size-20 rounded-2xl bg-muted"></div>
          <div class="mt-4 h-6 w-1/2 rounded bg-muted"></div>
          <div class="mt-2 h-4 w-1/3 rounded bg-muted"></div>
          <div class="mt-8 h-48 w-full rounded-2xl bg-muted"></div>
        </div>
      }
      @case ('invalid') {
        <div class="flex flex-col items-center pt-10 text-center">
          <span class="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <app-carta-icon name="mail" [size]="28" />
          </span>
          <h1 [id]="headingId()" tabindex="-1" class="mt-4 max-w-xs text-xl font-semibold outline-none">{{ t('msg.invalid') }}</h1>
          <p class="mt-2 max-w-xs text-sm text-muted-foreground">{{ t('msg.invalidText') }}</p>
        </div>
      }
      @default {
        <div class="flex flex-col items-center pt-10 text-center" role="alert">
          <span class="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <app-carta-icon name="alert" [size]="28" />
          </span>
          <h1 [id]="headingId()" tabindex="-1" class="mt-4 max-w-xs text-lg font-semibold outline-none">{{ message() }}</h1>
          <button
            type="button"
            class="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition active:scale-95 motion-reduce:transition-none"
            (click)="retry.emit()"
          >
            <app-carta-icon name="refresh" [size]="16" />
            {{ t('common.retry') }}
          </button>
        </div>
      }
    }
  `,
})
export class CartaMessagingState {
  readonly kind = input.required<'loading' | 'invalid' | 'error'>();
  readonly message = input('');
  readonly headingId = input.required<string>();
  readonly retry = output<void>();
  protected readonly t = inject(CartaI18n).t;
}
