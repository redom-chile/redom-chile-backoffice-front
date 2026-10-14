import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { PublicBannerDto } from '../../data-access/dtos/menu-marketing.dto';
import { bannerMeta, safeUrl } from '../carta-marketing';
import { CartaIcon } from './carta-icon';

/** Contenido de un banner (en el carrusel y en la ventana de ofertas). */
@Component({
  selector: 'app-carta-banner-content',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full flex-col' },
  template: `
    @let b = banner();
    @let meta = typeMeta();
    @if (b.imageUrl && !imageFailed()) {
      <img
        [src]="b.imageUrl"
        alt=""
        [attr.loading]="eager() ? null : 'lazy'"
        decoding="async"
        class="h-auto max-h-72 w-full bg-muted object-cover"
        (error)="imageFailed.set(true)"
      />
    }
    <span class="flex flex-1 items-start gap-3 p-4" [class.bg-primary]="!b.imageUrl || imageFailed()" [class.text-primary-foreground]="!b.imageUrl || imageFailed()">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-full"
        [class]="b.imageUrl && !imageFailed() ? 'bg-primary text-primary-foreground' : 'bg-primary-foreground/15'"
        aria-hidden="true"
      >
        <app-carta-icon [name]="meta.icon" [size]="20" />
      </span>
      <span class="min-w-0 flex-1 text-left">
        <span class="block text-[11px] font-semibold uppercase tracking-wide opacity-80">{{ meta.label }}</span>
        <span class="mt-0.5 block font-semibold leading-snug [overflow-wrap:anywhere]">{{ b.title }}</span>
        @if (b.subtitle) {
          <span class="mt-1 block text-sm leading-snug opacity-80 [overflow-wrap:anywhere]">{{ b.subtitle }}</span>
        }
      </span>
      @if (b.link.type !== 'none') {
        <app-carta-icon [name]="b.link.type === 'url' ? 'external' : 'chevron-right'" [size]="18" class="mt-3 opacity-70" />
      }
    </span>
  `,
})
export class CartaBannerContent {
  readonly banner = input.required<PublicBannerDto>();
  readonly eager = input(false);
  protected readonly imageFailed = signal(false);
  protected typeMeta = () => bannerMeta(this.banner().type);
}

/** Carrusel de banners (scroll-snap, deslizable), en el orden recibido. Avisa cuándo se ve cada uno y cuándo se toca. */
@Component({
  selector: 'app-carta-banners',
  imports: [CartaIcon, CartaBannerContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let list = banners();
    <section aria-roledescription="carrusel" aria-label="Destacados" class="relative">
      <div
        #track
        class="relative flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        (scroll)="onScroll()"
      >
        @for (b of list; track b.id; let i = $index) {
          <div
            #slide
            role="group"
            aria-roledescription="diapositiva"
            [attr.aria-label]="i + 1 + ' de ' + list.length + ': ' + b.title"
            [attr.data-index]="i"
            class="shrink-0 snap-center"
            [class]="list.length > 1 ? 'w-[88%] sm:w-[80%]' : 'w-full'"
          >
            @switch (b.link.type) {
              @case ('url') {
                @if (url(b); as href) {
                  <a [href]="href" target="_blank" rel="noopener noreferrer" [class]="cardClass" (click)="activate.emit(b)">
                    <app-carta-banner-content [banner]="b" [eager]="i === 0" />
                    <span class="sr-only">(se abre en una pestaña nueva)</span>
                  </a>
                } @else {
                  <div [class]="cardClass"><app-carta-banner-content [banner]="b" [eager]="i === 0" /></div>
                }
              }
              @case ('none') {
                <div [class]="cardClass"><app-carta-banner-content [banner]="b" [eager]="i === 0" /></div>
              }
              @default {
                <button type="button" [class]="cardClass + ' w-full'" (click)="activate.emit(b)">
                  <app-carta-banner-content [banner]="b" [eager]="i === 0" />
                </button>
              }
            }
          </div>
        }
      </div>

      @if (list.length > 1) {
        <div class="mt-2 flex items-center justify-center gap-1">
          <button
            type="button"
            class="hidden size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30 sm:flex"
            aria-label="Banner anterior"
            [disabled]="current() === 0"
            (click)="go(current() - 1)"
          >
            <app-carta-icon name="chevron-left" [size]="18" />
          </button>
          @for (b of list; track b.id; let i = $index) {
            <button
              type="button"
              class="flex size-6 items-center justify-center"
              [attr.aria-label]="'Ir al banner ' + (i + 1)"
              [attr.aria-current]="current() === i ? 'true' : null"
              (click)="go(i)"
            >
              <span class="h-1.5 rounded-full transition-all" [class]="current() === i ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/40'"></span>
            </button>
          }
          <button
            type="button"
            class="hidden size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30 sm:flex"
            aria-label="Banner siguiente"
            [disabled]="current() === list.length - 1"
            (click)="go(current() + 1)"
          >
            <app-carta-icon name="chevron-right" [size]="18" />
          </button>
        </div>
      }
    </section>
  `,
})
export class CartaBanners {
  readonly banners = input.required<readonly PublicBannerDto[]>();
  /** Banner tocado (solo los que tienen link). */
  readonly activate = output<PublicBannerDto>();
  /** Banner visible por primera vez. */
  readonly seen = output<PublicBannerDto>();

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  private readonly slides = viewChildren<ElementRef<HTMLElement>>('slide');

  protected readonly current = signal(0);
  protected readonly cardClass =
    'block h-full overflow-hidden rounded-2xl border border-border bg-card text-foreground text-left shadow-sm transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
  protected readonly url = (b: PublicBannerDto) => safeUrl(b.link.url);

  #observer: IntersectionObserver | null = null;

  constructor() {
    effect(() => {
      const elements = this.slides().map((ref) => ref.nativeElement);
      const list = this.banners();
      this.#observer?.disconnect();
      if (typeof IntersectionObserver === 'undefined' || !elements.length) return;
      this.#observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const banner = list[Number((e.target as HTMLElement).dataset['index'])];
            if (banner) this.seen.emit(banner);
          }
        },
        { threshold: 0.6 },
      );
      elements.forEach((el) => this.#observer!.observe(el));
    });
    inject(DestroyRef).onDestroy(() => this.#observer?.disconnect());
  }

  protected onScroll(): void {
    const track = this.track()?.nativeElement;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let distance = Infinity;
    this.slides().forEach((ref, i) => {
      const el = ref.nativeElement;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
      if (d < distance) [best, distance] = [i, d];
    });
    if (best !== this.current()) this.current.set(best);
  }

  protected go(index: number): void {
    const track = this.track()?.nativeElement;
    const slide = this.slides()[index]?.nativeElement;
    if (!track || !slide) return;
    track.scrollTo({ left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2, behavior: 'smooth' });
    this.current.set(index);
  }
}
