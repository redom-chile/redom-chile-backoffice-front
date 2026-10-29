import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { PublicProductDto } from '../../data-access/dtos/public-menu.dto';
import { DailySpecial, specialVariation } from '../carta-dynamic';
import { CartaI18n } from '../carta-i18n';
import { CartaIcon } from './carta-icon';
import { CartaPrice } from './carta-price';

/**
 * Etapa 11: "Plato del día" destacado. El precio especial ya viene en el producto (variations[].price, con el de la
 * carta en originalPrice), igual que en la tarjeta, el detalle y el carrito; porciones y hora de término (los minutos
 * que quedan, en la última hora). Agotado: atenuado, abre el detalle sin poder pedirlo.
 */
@Component({
  selector: 'app-carta-daily-special',
  imports: [CartaIcon, CartaPrice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let s = special();
    @let p = product();
    <section class="pt-4" aria-labelledby="carta-daily-special">
      <h2 id="carta-daily-special" class="flex items-center gap-2 text-xl font-bold tracking-tight">
        <app-carta-icon name="star" [size]="20" class="text-primary" />
        {{ t('dynamic.dailySpecial') }}
      </h2>
      <button
        type="button"
        class="carta-daily-special mt-3 flex w-full items-stretch gap-3 overflow-hidden rounded-3xl border-2 border-primary/40 bg-primary/5 text-left transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        [class.opacity-70]="s.soldOut"
        (click)="open.emit(p)"
      >
        @if (p.imageUrl) {
          <img [src]="p.imageUrl" alt="" loading="lazy" decoding="async" class="w-28 shrink-0 self-stretch bg-muted object-cover sm:w-36" [class.grayscale]="s.soldOut" />
        }
        <span class="flex min-w-0 flex-1 flex-col gap-1 py-3 pr-4" [class.pl-4]="!p.imageUrl">
          <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-base font-bold leading-snug [overflow-wrap:anywhere]">{{ s.title || p.name }}</span>
            @if (s.soldOut) {
              <span class="rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-background">{{ t('common.soldOut') }}</span>
            }
          </span>
          @if (s.title && s.title !== p.name) {
            <span class="text-xs text-muted-foreground [overflow-wrap:anywhere]">{{ p.name }}</span>
          }
          @if (s.note) {
            <span class="line-clamp-3 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{{ s.note }}</span>
          }
          @if (price(); as pr) {
            <span class="text-base font-bold"><app-carta-price [price]="pr.price" [originalPrice]="pr.originalPrice" /></span>
          }
          @if (!s.soldOut && (portions() || until())) {
            <span class="mt-0.5 flex flex-wrap gap-1.5">
              @if (portions(); as text) {
                <span class="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">
                  <app-carta-icon name="flame" [size]="12" />
                  {{ text }}
                </span>
              }
              @if (until(); as text) {
                <span class="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[0.6875rem] font-semibold text-foreground">
                  <app-carta-icon name="clock" [size]="12" />
                  {{ text }}
                </span>
              }
            </span>
          }
        </span>
      </button>
    </section>
  `,
})
export class CartaDailySpecial {
  readonly special = input.required<DailySpecial>();
  readonly product = input.required<PublicProductDto>();
  /** "HH:MM" de término en la zona del local. */
  readonly endsLabel = input<string | null>(null);
  /** Minutos que quedan (null: sin hora válida). */
  readonly minutesLeft = input<number | null>(null);
  readonly open = output<PublicProductDto>();

  readonly #i18n = inject(CartaI18n);
  protected readonly t = this.#i18n.t;

  protected readonly price = computed(() => {
    const v = specialVariation(this.product(), this.special());
    return v ? { price: v.price, originalPrice: v.originalPrice ?? null } : null;
  });

  protected readonly portions = computed(() => {
    const n = this.special().portionsLeft;
    return n != null && n > 0 ? this.#i18n.tn('dynamic.portionsLeft', n) : null;
  });

  protected readonly until = computed(() => {
    const label = this.endsLabel();
    const left = this.minutesLeft();
    const parts = label ? [this.t('dynamic.until', { time: label })] : [];
    if (left != null && left > 0 && left <= 60) parts.push(this.t('dynamic.minutesLeft', { n: left }));
    return parts.join(' · ') || null;
  });
}
