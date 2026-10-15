import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { OrderFeedbackResultDto } from '../../data-access/dtos/table-service.dto';
import { PublicMenuApiService } from '../../data-access/public-menu-api.service';
import { safeUrl } from '../carta-marketing';
import { CartaI18n, cartaErrorMessage, ct, CartaKey } from '../carta-i18n';
import { CartaIcon } from './carta-icon';

const MAX_COMMENT = 500;
const RATING_KEYS: readonly CartaKey[] = ['feedback.rating1', 'feedback.rating2', 'feedback.rating3', 'feedback.rating4', 'feedback.rating5'];

/**
 * Encuesta del pedido (etapa 4): 5 estrellas (grupo de radios nativo: flechas para cambiar) y un comentario opcional.
 * Con googleReviewUrl invita a dejar una reseña en Google.
 */
@Component({
  selector: 'app-carta-order-feedback',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="rounded-2xl border border-border bg-card px-4 py-4" aria-labelledby="carta-feedback-title">
      @if (result(); as r) {
        <div role="status" class="text-center">
          @if (reviewUrl(); as url) {
            <h3 id="carta-feedback-title" class="text-base font-bold">{{ t('feedback.reviewTitle') }}</h3>
            <p class="mt-1 text-sm text-muted-foreground">{{ t('feedback.reviewText') }}</p>
            <a
              [href]="url"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] motion-reduce:transition-none"
            >
              {{ t('feedback.reviewButton') }}
              <app-carta-icon name="external" [size]="16" />
              <span class="sr-only">{{ t('feedback.newTab') }}</span>
            </a>
          } @else {
            <p id="carta-feedback-title" class="flex items-center justify-center gap-2 text-base font-bold">
              <app-carta-icon name="check" [size]="18" class="text-emerald-600 dark:text-emerald-400" />
              {{ r === 'already' ? t('feedback.already') : t('feedback.thanks') }}
            </p>
          }
        </div>
      } @else {
        <form novalidate (submit)="send($event)">
          <fieldset>
            <legend id="carta-feedback-title" class="text-base font-bold">{{ t('feedback.question') }}</legend>
            <div class="mt-2 flex items-center gap-1" role="radiogroup" aria-labelledby="carta-feedback-title">
              @for (n of stars; track n) {
                <label
                  class="relative flex size-11 cursor-pointer items-center justify-center rounded-full transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none"
                  [class]="n <= shown() ? 'text-amber-500' : 'text-muted-foreground/50'"
                  (mouseenter)="hover.set(n)"
                  (mouseleave)="hover.set(0)"
                >
                  <input type="radio" name="carta-feedback-rating" class="sr-only" [value]="n" [checked]="rating() === n" (change)="rating.set(n)" />
                  <app-carta-icon name="star" [size]="30" [filled]="n <= shown()" />
                  <span class="sr-only">{{ tn('feedback.stars', n, { label: label(n) }) }}</span>
                </label>
              }
              @if (rating()) {
                <span class="ml-1 text-sm font-medium text-muted-foreground" aria-hidden="true">{{ label(rating()) }}</span>
              }
            </div>
          </fieldset>

          <label for="carta-feedback-comment" class="mt-3 block text-sm font-semibold">{{ t('feedback.comment') }} <span class="font-normal text-muted-foreground">{{ t('feedback.optional') }}</span></label>
          <textarea
            id="carta-feedback-comment"
            rows="2"
            class="mt-1.5 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-[0.9375rem] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 motion-reduce:transition-none"
            [placeholder]="t('feedback.placeholder')"
            [maxLength]="maxComment"
            [value]="comment()"
            aria-describedby="carta-feedback-count"
            (input)="comment.set($any($event.target).value)"
          ></textarea>
          <p id="carta-feedback-count" class="mt-1 text-right text-xs text-muted-foreground tabular-nums">{{ comment().length }}/{{ maxComment }}</p>

          @if (error(); as e) {
            <p class="mt-1 flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
              <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
              {{ e }}
            </p>
          }
          <button
            type="submit"
            class="mt-3 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none"
            [disabled]="!rating() || sending()"
          >
            {{ sending() ? t('feedback.sending') : t('feedback.send') }}
          </button>
        </form>
      }
    </section>
  `,
})
export class CartaOrderFeedback {
  readonly orderId = input.required<string>();
  /** Enviada (o ya enviada antes): el padre deja de mostrar la encuesta cuando el pedido trae feedback. */
  readonly sent = output<void>();

  readonly #api = inject(PublicMenuApiService);
  #sub: Subscription | null = null;

  protected readonly stars = [1, 2, 3, 4, 5];
  readonly #i18n = inject(CartaI18n);
  protected readonly t = this.#i18n.t;
  protected readonly tn = this.#i18n.tn;
  protected readonly label = (n: number) => ct(RATING_KEYS[n - 1]);
  protected readonly maxComment = MAX_COMMENT;
  protected readonly rating = signal(0);
  protected readonly hover = signal(0);
  protected readonly shown = computed(() => this.hover() || this.rating());
  protected readonly comment = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<OrderFeedbackResultDto | 'already' | null>(null);
  protected readonly reviewUrl = computed(() => {
    const r = this.result();
    return r && r !== 'already' && r.googleReviewUrl ? safeUrl(r.googleReviewUrl) : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#sub?.unsubscribe());
  }

  protected send(event: Event): void {
    event.preventDefault();
    const rating = this.rating();
    if (!rating || this.sending()) return;
    const comment = this.comment().trim().slice(0, MAX_COMMENT);
    this.sending.set(true);
    this.error.set(null);
    this.#sub = this.#api.sendOrderFeedback(this.orderId(), comment ? { rating, comment } : { rating }).subscribe({
      next: (result) => {
        this.sending.set(false);
        this.result.set(result);
        this.sent.emit();
      },
      error: (e) => {
        this.sending.set(false);
        const api = readApiError(e);
        if (api.code === 'FEEDBACK_ALREADY_SENT') {
          this.result.set('already');
          this.sent.emit();
        } else if (api.code === 'FEEDBACK_NOT_ALLOWED') this.error.set(ct('feedback.notAllowed'));
        else if (api.status === 404) this.error.set(ct('feedback.notFound'));
        else if (api.code === 'RATE_LIMITED' || api.status === 429) this.error.set(ct('feedback.tooMany'));
        else if (api.status === 0) this.error.set(ct('feedback.offline'));
        else this.error.set(cartaErrorMessage(e, ct('feedback.failed')));
      },
    });
  }
}
