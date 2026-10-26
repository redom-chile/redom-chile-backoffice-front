import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, map, Subscription } from 'rxjs';
import { MessagingSurveyInfoDto, PublicMenuApiService } from '../../data-access/public-menu-api.service';
import { cartaLocale } from '../carta-i18n';
import { CartaIcon } from '../ui/carta-icon';
import { CartaMessagingHeader, CartaMessagingLayout, CartaMessagingLoad, CartaMessagingPage, CartaMessagingState, readMessagingLoadError } from '../ui/carta-messaging';
import { CartaOrderFeedback } from '../ui/carta-order-feedback';

const HEADING = 'carta-survey-heading';

/** Fecha de la visita (solo el día), en la zona del negocio (Chile por defecto: la respuesta no la trae). */
function formatVisitDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(cartaLocale(), { dateStyle: 'long', timeZone: 'America/Santiago' }).format(date);
  } catch {
    return new Intl.DateTimeFormat(cartaLocale(), { dateStyle: 'long' }).format(date);
  }
}

/**
 * /carta/encuesta?token=… (etapa 10.2): la encuesta de la visita que envía el correo "después de la visita". Sin login;
 * el token firmado identifica la venta o el pedido. Reutiliza la encuesta del pedido (estrellas, comentario y la
 * invitación a la reseña de Google con 4 o 5 estrellas).
 */
@Component({
  selector: 'app-carta-survey-page',
  imports: [CartaMessagingLayout, CartaMessagingHeader, CartaMessagingState, CartaOrderFeedback, CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = state();
    <app-carta-messaging-layout [busy]="s.status === 'loading'" (choose)="chooseLanguage($event)">
      @switch (s.status) {
        @case ('ready') {
          @if (s.status === 'ready') {
            <app-carta-messaging-header [name]="s.data.businessName" [logoUrl]="s.data.logoUrl" [headingId]="heading">
              @if (s.data.locationName || visitDate()) {
                <p class="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {{ s.data.locationName }}
                  @if (s.data.locationName && visitDate()) {
                    <span aria-hidden="true"> · </span>
                  }
                  @if (visitDate(); as date) {
                    {{ t('survey.visitAt', { date }) }}
                  }
                </p>
              }
            </app-carta-messaging-header>
            <div class="mt-8">
              @if (s.data.answered) {
                <div class="rounded-2xl border border-border bg-card px-4 py-5 text-center" role="status">
                  <p class="flex items-center justify-center gap-2 text-base font-bold">
                    <app-carta-icon name="check" [size]="18" class="text-emerald-600 dark:text-emerald-400" />
                    {{ t('survey.answered') }}
                  </p>
                </div>
              } @else {
                <app-carta-order-feedback
                  [surveyToken]="token()"
                  [question]="t('survey.title')"
                  [alreadyText]="t('survey.answered')"
                  (invalid)="setInvalid()"
                />
              }
            </div>
          }
        }
        @case ('invalid') {
          <app-carta-messaging-state kind="invalid" [headingId]="heading" />
        }
        @case ('error') {
          @if (s.status === 'error') {
            <app-carta-messaging-state
              kind="error"
              [headingId]="heading"
              [message]="s.rateLimited ? t('state.rateLimited') : s.offline ? t('state.offline') : t('msg.loadFailed')"
              (retry)="load()"
            />
          }
        }
        @default {
          <app-carta-messaging-state kind="loading" [headingId]="heading" />
        }
      }
    </app-carta-messaging-layout>
  `,
})
export class CartaSurveyPage extends CartaMessagingPage {
  readonly #api = inject(PublicMenuApiService);
  #request: Subscription | null = null;

  protected readonly heading = HEADING;
  protected readonly token = signal('');
  protected readonly state = signal<CartaMessagingLoad<MessagingSurveyInfoDto>>({ status: 'loading' });
  /** Se recalcula al cambiar de idioma (cartaLocale es reactivo). */
  protected readonly visitDate = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? formatVisitDate(s.data.date) : null;
  });

  constructor() {
    super('survey.pageTitle');
    inject(ActivatedRoute)
      .queryParamMap.pipe(
        map((params) => params.get('token')?.trim() ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((token) => {
        this.token.set(token);
        this.load();
      });
    inject(DestroyRef).onDestroy(() => this.#request?.unsubscribe());
  }

  protected load(): void {
    this.#request?.unsubscribe();
    const token = this.token();
    if (!token) {
      this.setInvalid();
      return;
    }
    this.state.set({ status: 'loading' });
    this.#request = this.#api.getMessagingSurvey(token).subscribe({
      next: (data) => {
        this.state.set({ status: 'ready', data });
        this.updateTitle(data.businessName);
        this.focus(HEADING);
      },
      error: (e) => {
        this.state.set(readMessagingLoadError(e));
        this.focus(HEADING);
      },
    });
  }

  protected setInvalid(): void {
    this.state.set({ status: 'invalid' });
    this.updateTitle(null);
    this.focus(HEADING);
  }
}
