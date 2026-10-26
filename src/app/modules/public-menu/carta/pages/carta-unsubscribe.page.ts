import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, map, Subscription } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import {
  MessagingUnsubscribeInfoDto,
  MessagingUnsubscribeResultDto,
  MessagingUnsubscribeScope,
  PublicMenuApiService,
} from '../../data-access/public-menu-api.service';
import { cartaErrorMessage, ct } from '../carta-i18n';
import { CartaIcon } from '../ui/carta-icon';
import {
  CartaMessagingHeader,
  CartaMessagingLayout,
  CartaMessagingLoad,
  CartaMessagingPage,
  CartaMessagingState,
  messagingTypeLabel,
  readMessagingLoadError,
} from '../ui/carta-messaging';

const HEADING = 'carta-unsubscribe-heading';
const DONE_HEADING = 'carta-unsubscribe-done';
const SCOPES: readonly MessagingUnsubscribeScope[] = ['thisType', 'allFromBusiness'];

/**
 * /carta/baja?token=… (etapa 10.2): darse de baja de un tipo de correo o de todos los del negocio. Sin login; el token
 * firmado trae el negocio, el correo y el tipo. Desde una campaña (o con "todo") el backend retira también el
 * consentimiento de novedades (marketingConsentWithdrawn).
 */
@Component({
  selector: 'app-carta-unsubscribe-page',
  imports: [CartaMessagingLayout, CartaMessagingHeader, CartaMessagingState, CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = state();
    <app-carta-messaging-layout [busy]="s.status === 'loading'" (choose)="chooseLanguage($event)">
      @switch (s.status) {
        @case ('ready') {
          @if (s.status === 'ready') {
            @let d = s.data;
            @let typeName = typeLabel(d.type);
            <app-carta-messaging-header [name]="d.businessName" [headingId]="heading">
              <p class="mt-1 text-sm text-muted-foreground">{{ t('unsub.pageTitle') }}</p>
            </app-carta-messaging-header>

            <div class="mt-8" aria-live="polite">
              @if (result(); as r) {
                <div class="rounded-2xl border border-border bg-card px-4 py-5 text-center">
                  <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <app-carta-icon name="check" [size]="22" />
                  </span>
                  <h2 [id]="doneHeading" tabindex="-1" class="mt-3 text-base font-bold outline-none">{{ t('unsub.doneTitle') }}</h2>
                  <p class="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {{
                      r.scope === 'allFromBusiness'
                        ? t('unsub.doneAll', { business: r.businessName })
                        : t('unsub.doneThisType', { type: typeLabel(r.type), business: r.businessName })
                    }}
                  </p>
                  @if (r.marketingConsentWithdrawn) {
                    <p class="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">{{ t('unsub.marketing', { business: r.businessName }) }}</p>
                  }
                </div>
              } @else {
                <form class="rounded-2xl border border-border bg-card px-4 py-4" novalidate (submit)="send($event)">
                  <p class="text-sm [overflow-wrap:anywhere]">{{ t('unsub.sentTo', { email: d.email }) }}</p>
                  <p class="mt-1 text-sm text-muted-foreground">{{ t('unsub.type', { type: typeName }) }}</p>
                  <fieldset class="mt-4">
                    <legend class="text-base font-bold">{{ t('unsub.legend') }}</legend>
                    <div class="mt-2 grid gap-2">
                      @for (scope of options(d); track scope) {
                        <label
                          class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none"
                          [class]="selected() === scope ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'"
                        >
                          <input
                            type="radio"
                            name="carta-unsubscribe-scope"
                            class="mt-0.5 size-4 accent-primary"
                            [value]="scope"
                            [checked]="selected() === scope"
                            [attr.aria-describedby]="'carta-unsubscribe-hint-' + scope"
                            (change)="selected.set(scope)"
                          />
                          <span class="min-w-0 flex-1">
                            <span class="block text-sm font-semibold [overflow-wrap:anywhere]">
                              {{ scope === 'thisType' ? t('unsub.thisType') : t('unsub.allFromBusiness', { business: d.businessName }) }}
                            </span>
                            <span [id]="'carta-unsubscribe-hint-' + scope" class="mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                              {{
                                scope === 'thisType'
                                  ? t('unsub.thisTypeHint', { type: typeName, business: d.businessName })
                                  : t('unsub.allFromBusinessHint')
                              }}
                            </span>
                          </span>
                        </label>
                      }
                    </div>
                  </fieldset>
                  @if (error(); as e) {
                    <p class="mt-3 flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
                      <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
                      {{ e }}
                    </p>
                  }
                  <button
                    type="submit"
                    class="mt-4 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none"
                    [disabled]="!selected() || sending()"
                  >
                    {{ sending() ? t('unsub.sending') : t('unsub.submit') }}
                  </button>
                </form>
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
export class CartaUnsubscribePage extends CartaMessagingPage {
  readonly #api = inject(PublicMenuApiService);
  #request: Subscription | null = null;

  protected readonly heading = HEADING;
  protected readonly doneHeading = DONE_HEADING;
  protected readonly typeLabel = messagingTypeLabel;
  #token = '';
  protected readonly state = signal<CartaMessagingLoad<MessagingUnsubscribeInfoDto>>({ status: 'loading' });
  protected readonly selected = signal<MessagingUnsubscribeScope | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<MessagingUnsubscribeResultDto | null>(null);

  constructor() {
    super('unsub.pageTitle');
    inject(ActivatedRoute)
      .queryParamMap.pipe(
        map((params) => params.get('token')?.trim() ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((token) => {
        this.#token = token;
        this.load();
      });
    inject(DestroyRef).onDestroy(() => this.#request?.unsubscribe());
  }

  /** Las que ofrece el backend, en el orden del contrato (sin opciones conocidas: las dos). */
  protected options(data: MessagingUnsubscribeInfoDto): readonly MessagingUnsubscribeScope[] {
    const offered = SCOPES.filter((scope) => data.options?.includes(scope));
    return offered.length ? offered : SCOPES;
  }

  protected load(): void {
    this.#request?.unsubscribe();
    this.result.set(null);
    this.error.set(null);
    this.selected.set(null);
    if (!this.#token) {
      this.#invalid();
      return;
    }
    this.state.set({ status: 'loading' });
    this.#request = this.#api.getMessagingUnsubscribe(this.#token).subscribe({
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

  protected send(event: Event): void {
    event.preventDefault();
    const scope = this.selected();
    if (!scope || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    this.#request?.unsubscribe();
    this.#request = this.#api.unsubscribeMessaging({ token: this.#token, scope }).subscribe({
      next: (result) => {
        this.sending.set(false);
        this.result.set(result);
        this.focus(DONE_HEADING);
      },
      error: (e) => {
        this.sending.set(false);
        const api = readApiError(e);
        if (api.code === 'MESSAGING_TOKEN_INVALID') this.#invalid();
        else this.error.set(cartaErrorMessage(e, ct('unsub.failed')));
      },
    });
  }

  #invalid(): void {
    this.state.set({ status: 'invalid' });
    this.updateTitle(null);
    this.focus(HEADING);
  }
}
