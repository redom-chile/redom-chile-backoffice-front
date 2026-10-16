import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { CartaEmbed } from '../carta-embed';
import { CartaI18n } from '../carta-i18n';
import { CartaIcon } from './carta-icon';

/** Página "no disponible", sin más detalles (404 MENU_NOT_FOUND). */
@Component({
  selector: 'app-carta-unavailable',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <span class="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <app-carta-icon name="utensils" [size]="28" />
      </span>
      <h1 class="text-xl font-semibold">{{ t('state.unavailable') }}</h1>
      <a href="https://redom.cl" [attr.target]="embedded ? '_blank' : null" [attr.rel]="embedded ? 'noopener' : null" class="text-sm text-muted-foreground underline-offset-4 hover:underline">redom.cl</a>
    </div>
  `,
})
export class CartaUnavailable {
  /** Incrustada en otra web: el enlace se abre en una pestaña nueva. */
  protected readonly embedded = inject(CartaEmbed).active;
  protected readonly t = inject(CartaI18n).t;
}

/** 429 RATE_LIMITED: aviso y reintento automático al minuto. Sirve también para errores de red. */
@Component({
  selector: 'app-carta-retry',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground" role="alert">
      <span class="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <app-carta-icon name="alert" [size]="28" />
      </span>
      <h1 class="max-w-xs text-lg font-semibold">{{ message() ?? t('state.rateLimited') }}</h1>
      @if (seconds() > 0) {
        <p class="text-sm text-muted-foreground" aria-live="polite">{{ t('state.retryIn', { n: seconds() }) }}</p>
      }
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition active:scale-95"
        (click)="retry.emit()"
      >
        <app-carta-icon name="refresh" [size]="16" />
        {{ t('common.retry') }}
      </button>
    </div>
  `,
})
export class CartaRetry {
  /** null: "Demasiadas solicitudes…" en el idioma activo. */
  readonly message = input<string | null>(null);
  /** Segundos para el reintento automático; 0 = sin reintento automático. */
  readonly delay = input(60);
  readonly retry = output<void>();

  protected readonly t = inject(CartaI18n).t;
  protected readonly seconds = signal(0);
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      this.#stop();
      const delay = this.delay();
      this.seconds.set(delay);
      if (delay <= 0) return;
      this.#timer = setInterval(() => {
        const next = this.seconds() - 1;
        this.seconds.set(next);
        if (next <= 0) {
          this.#stop();
          this.retry.emit();
        }
      }, 1000);
    });
    inject(DestroyRef).onDestroy(() => this.#stop());
  }

  #stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }
}

/** Esqueleto mientras carga la carta. */
@Component({
  selector: 'app-carta-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh bg-background" aria-busy="true" [attr.aria-label]="t('state.loading')">
      <div class="mx-auto max-w-2xl animate-pulse px-4 pt-8">
        <div class="flex items-center gap-4">
          <div class="size-16 rounded-2xl bg-muted"></div>
          <div class="flex-1 space-y-2">
            <div class="h-5 w-2/3 rounded bg-muted"></div>
            <div class="h-4 w-1/3 rounded bg-muted"></div>
          </div>
        </div>
        <div class="mt-6 flex gap-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-9 w-24 rounded-full bg-muted"></div>
          }
        </div>
        <div class="mt-8 space-y-3">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="flex gap-3 rounded-2xl border border-border p-3">
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/2 rounded bg-muted"></div>
                <div class="h-3 w-5/6 rounded bg-muted"></div>
                <div class="h-4 w-16 rounded bg-muted"></div>
              </div>
              <div class="size-20 rounded-xl bg-muted"></div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class CartaSkeleton {
  protected readonly t = inject(CartaI18n).t;
}
