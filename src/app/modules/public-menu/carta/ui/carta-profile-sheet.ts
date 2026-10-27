import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, Injector, input, output, signal, viewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { OtpRequestResultDto } from '../../data-access/dtos/customer-profiles.dto';
import { PublicLocationMenuDto, PublicTagDto } from '../../data-access/dtos/public-menu.dto';
import { PublicCustomerApiService } from '../../data-access/public-customer-api.service';
import { allergenShortName, CartaCustomer } from '../carta-customer';
import { CartaLegal } from '../carta-legal';
import { CARTA_LANG_META, CARTA_LANGS, CartaI18n, CartaLang, cartaErrorMessage, cartaLocale, isCartaLang } from '../carta-i18n';
import { isEmail, ONLINE_LIMITS } from '../carta-online';
import { CartaIcon, CartaTagIcon } from './carta-icon';
import { CartaLegalConsent, CartaLegalPending, CartaMyDocuments } from './carta-legal';

/** Inicio del texto de Redom (customerProfiles.consentText llega con él si el local no tiene uno propio). */
const REDOM_CONSENT_START = 'Acepto que Redom guarde mi correo';

const INPUT =
  'mt-1.5 block w-full rounded-2xl border border-border bg-card px-4 py-3 text-[0.9375rem] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 motion-reduce:transition-none';
const PRIMARY =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const LINK = 'font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-50 disabled:no-underline';

/** Dieta, alérgenos que evita e idioma: en el perfil si está identificado; si no, en este navegador. */
@Component({
  selector: 'app-carta-preferences',
  imports: [CartaTagIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let prefs = customer.preferences();
    <section aria-labelledby="carta-prefs-title">
      <h3 id="carta-prefs-title" class="text-base font-semibold">{{ t('customer.prefs') }}</h3>
      <p class="mt-0.5 text-xs text-muted-foreground">{{ t(customer.verified() ? 'customer.prefsSynced' : 'customer.prefsLocal') }} {{ t('customer.prefsHint') }}</p>
      @if (diets().length) {
        <fieldset class="mt-3">
          <legend class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('customer.diet') }}</legend>
          <div class="flex flex-wrap gap-1.5">
            @for (tag of diets(); track tag.code) {
              @let on = prefs.dietTags.includes(tag.code);
              <button type="button" [class]="chip(on)" [attr.aria-pressed]="on" (click)="toggle('dietTags', tag.code)">
                <app-carta-tag-icon [icon]="tag.icon" />
                {{ tag.name }}
              </button>
            }
          </div>
        </fieldset>
      }
      @if (allergens().length) {
        <fieldset class="mt-3">
          <legend class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('customer.avoid') }}</legend>
          <div class="flex flex-wrap gap-1.5">
            @for (tag of allergens(); track tag.code) {
              @let on = prefs.allergenTags.includes(tag.code);
              <button type="button" [class]="chip(on)" [attr.aria-pressed]="on" (click)="toggle('allergenTags', tag.code)">
                <app-carta-tag-icon [icon]="tag.icon" />
                {{ short(tag) }}
              </button>
            }
          </div>
        </fieldset>
      }
      <div class="mt-3">
        <label for="carta-prefs-lang" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('customer.language') }}</label>
        <select id="carta-prefs-lang" [class]="input" (change)="setLanguage($any($event.target).value)">
          <option value="" [selected]="!prefs.language">{{ t('customer.languageAuto') }}</option>
          @for (l of langs; track l) {
            <option [value]="l" [selected]="prefs.language === l">{{ meta[l].name }}</option>
          }
        </select>
      </div>
    </section>
  `,
})
export class CartaPreferences {
  readonly tags = input.required<readonly PublicTagDto[]>();
  readonly language = output<CartaLang>();

  protected readonly customer = inject(CartaCustomer);
  protected readonly t = inject(CartaI18n).t;
  protected readonly input = INPUT;
  protected readonly langs = CARTA_LANGS;
  protected readonly meta = CARTA_LANG_META;
  protected readonly short = allergenShortName;
  protected readonly diets = computed(() => this.tags().filter((t) => t.kind === 'diet'));
  protected readonly allergens = computed(() => this.tags().filter((t) => t.kind === 'allergen'));
  protected readonly chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-primary ${
      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'
    }`;

  protected toggle(kind: 'dietTags' | 'allergenTags', code: string): void {
    const list = this.customer.preferences()[kind];
    this.customer.setPreferences({ [kind]: list.includes(code) ? list.filter((c) => c !== code) : [...list, code] });
  }

  protected setLanguage(value: string): void {
    const lang = isCartaLang(value) ? value : null;
    this.customer.setPreferences({ language: lang });
    if (lang) this.language.emit(lang);
  }
}

type Step = 'email' | 'code';

/**
 * Hoja "Tu perfil" (etapa 10). Con customerProfiles en modo verified: documentos legales y correo → código de 6 dígitos →
 * perfil (datos, documentos pendientes, saldo, preferencias, "Mis documentos", cerrar sesión, borrar). Sin eso (o sin cuota de códigos): solo las preferencias
 * en el navegador.
 */
@Component({
  selector: 'app-carta-profile-sheet',
  imports: [CartaIcon, CartaPreferences, CartaLegalConsent, CartaLegalPending, CartaMyDocuments],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let m = menu();
    @let cp = m.customerProfiles;
    @let profile = customer.profile();
    <div class="px-5 pb-6 pt-5">
      <h2 tabindex="-1" class="pr-10 text-xl font-bold tracking-tight outline-none">
        @if (customer.verified() && profile) {
          {{ profile.name ? t('customer.hello', { name: profile.name }) : t('customer.helloNoName') }}
        } @else {
          {{ t('customer.title') }}
        }
      </h2>
      <p class="sr-only" aria-live="polite">{{ status() }}</p>

      @if (customer.verified() && profile) {
        @if (customer.legalPending(); as pending) {
          @if (pending.length) {
            <app-carta-legal-pending class="mt-4" [documents]="pending" (done)="legalDone($event)" />
          }
        }
        <section class="mt-4 rounded-2xl border border-border px-4 py-3" aria-labelledby="carta-cu-data-title">
          <h3 id="carta-cu-data-title" class="text-base font-semibold">{{ t('customer.data') }}</h3>
          <p class="mt-2 flex items-center gap-2 text-sm">
            <app-carta-icon name="mail" [size]="16" class="shrink-0 text-muted-foreground" />
            <span class="font-medium [overflow-wrap:anywhere]">{{ profile.email }}</span>
          </p>
          <p class="mt-0.5 pl-6 text-xs text-muted-foreground">{{ t('customer.emailIdentity') }}</p>
          @if (editing()) {
            <form class="mt-3 grid gap-3" novalidate (submit)="saveData($event)">
              <div>
                <label for="carta-cu-edit-name" class="block text-sm font-semibold">{{ t('customer.name') }} <span class="font-normal text-muted-foreground">{{ t('cart.optional') }}</span></label>
                <input id="carta-cu-edit-name" type="text" autocomplete="name" [class]="input" [maxLength]="limits.name" [value]="editName()" (input)="editName.set($any($event.target).value)" />
              </div>
              @if (showPhone()) {
                <div>
                  <label for="carta-cu-edit-phone" class="block text-sm font-semibold">{{ t('customer.phone') }} <span class="font-normal text-muted-foreground">{{ t('cart.optional') }}</span></label>
                  <input
                    id="carta-cu-edit-phone"
                    type="tel"
                    inputmode="tel"
                    autocomplete="tel"
                    placeholder="+56 9 1234 5678"
                    maxlength="24"
                    [class]="input"
                    [value]="editPhone()"
                    [attr.aria-invalid]="!!phoneError()"
                    [attr.aria-describedby]="phoneError() ? 'carta-cu-edit-phone-error' : 'carta-cu-edit-phone-hint'"
                    (input)="editPhone.set($any($event.target).value)"
                  />
                  @if (phoneError(); as e) {
                    <p id="carta-cu-edit-phone-error" class="mt-1 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
                  } @else {
                    <p id="carta-cu-edit-phone-hint" class="mt-1 text-xs text-muted-foreground">{{ t('customer.phoneHint') }}</p>
                  }
                </div>
              }
              @if (error(); as e) {
                <p class="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">{{ e }}</p>
              }
              <div class="flex flex-wrap gap-2">
                <button
                  type="submit"
                  class="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  [disabled]="busy()"
                  [attr.aria-busy]="busy() || null"
                >
                  {{ busy() ? t('customer.saving') : t('customer.save') }}
                </button>
                <button type="button" class="rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted" (click)="cancelEdit()">
                  {{ t('customer.cancel') }}
                </button>
              </div>
            </form>
          } @else {
            <p class="mt-2 flex items-center gap-2 text-sm">
              <app-carta-icon name="user" [size]="16" class="shrink-0 text-muted-foreground" />
              <span [class.text-muted-foreground]="!profile.name" class="[overflow-wrap:anywhere]">{{ profile.name || t('customer.noName') }}</span>
            </p>
            @if (showPhone()) {
              <p class="mt-2 flex items-center gap-2 text-sm">
                <app-carta-icon name="phone" [size]="16" class="shrink-0 text-muted-foreground" />
                <span [class.text-muted-foreground]="!profile.phone" class="tabular-nums">{{ profile.phone || t('customer.noPhone') }}</span>
              </p>
            }
            <button id="carta-cu-edit" type="button" class="mt-3 text-sm {{ link }}" (click)="startEdit()">{{ t('customer.edit') }}</button>
          }
        </section>
        @if (customer.showLoyalty() && customer.loyalty(); as l) {
          <p class="mt-4 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold">
            <app-carta-icon name="star" [size]="18" class="text-primary" />
            {{ tn(l.mechanic === 'stamps' ? 'customer.balanceStamps' : 'customer.balancePoints', l.balance, { program: l.programName }) }}
          </p>
        }
        <app-carta-preferences class="mt-6" [tags]="m.tags" (language)="language.emit($event)" />
        <app-carta-my-documents class="mt-6 border-t border-border pt-5" [businessSlug]="m.business.slug" [businessName]="m.business.name" />

        <div class="mt-6 grid gap-2 border-t border-border pt-4">
          @if (confirmLogout()) {
            <div class="rounded-2xl border border-border bg-muted/40 px-4 py-3" role="alertdialog" aria-labelledby="carta-logout-text">
              <p id="carta-logout-text" class="text-sm">{{ t('customer.logoutConfirm') }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  id="carta-logout-yes"
                  type="button"
                  class="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  (click)="logout()"
                >
                  {{ t('customer.logoutYes') }}
                </button>
                <button type="button" class="rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted" (click)="cancelLogout()">
                  {{ t('customer.cancel') }}
                </button>
              </div>
            </div>
          } @else if (confirmDelete()) {
            <div class="rounded-2xl border border-rose-500/40 bg-rose-500/5 px-4 py-3" role="alertdialog" aria-labelledby="carta-delete-text">
              <p id="carta-delete-text" class="text-sm">{{ t('customer.deleteConfirm') }}</p>
              @if (error(); as e) {
                <p class="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">{{ e }}</p>
              }
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                  [disabled]="busy()"
                  (click)="deleteData()"
                >
                  {{ t('customer.deleteYes') }}
                </button>
                <button type="button" class="rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted" (click)="confirmDelete.set(false)">
                  {{ t('customer.cancel') }}
                </button>
              </div>
            </div>
          } @else {
            <button
              id="carta-logout"
              type="button"
              class="rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
              (click)="askLogout()"
            >
              {{ t('customer.logout') }}
            </button>
            <button type="button" class="rounded-full px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400" (click)="askDelete()">
              {{ t('customer.delete') }}
            </button>
          }
        </div>
      } @else {
        @if (canVerify()) {
          <p class="mt-1 text-sm text-muted-foreground">{{ t('customer.intro') }}</p>
          @if (step() === 'email') {
            <form class="mt-4 grid gap-3" novalidate (submit)="sendCode($event)">
              <div>
                <label for="carta-cu-email" class="block text-sm font-semibold">{{ t('customer.email') }}</label>
                <input
                  id="carta-cu-email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  autocapitalize="off"
                  spellcheck="false"
                  placeholder="tu@correo.cl"
                  [class]="input"
                  [maxLength]="limits.email"
                  [value]="email()"
                  [attr.aria-invalid]="!!fieldError()"
                  [attr.aria-describedby]="fieldError() ? 'carta-cu-error' : 'carta-cu-email-hint'"
                  (input)="email.set($any($event.target).value)"
                />
                <p id="carta-cu-email-hint" class="mt-1 text-xs text-muted-foreground">{{ t('customer.emailHint') }}</p>
              </div>
              <app-carta-legal-consent [businessSlug]="m.business.slug" [businessName]="m.business.name" [localText]="localConsentText()" [privacyUrl]="cp?.privacyUrl ?? null" />
              @if (fieldError() || error(); as e) {
                <p id="carta-cu-error" class="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">{{ e }}</p>
              }
              <button type="submit" [class]="primary" [disabled]="busy()" [attr.aria-busy]="busy() || null">
                {{ busy() ? t('customer.sending') : t('customer.sendCode') }}
              </button>
            </form>
          } @else {
            <form class="mt-4 grid gap-3" novalidate (submit)="verify($event)">
              <p class="rounded-2xl bg-muted px-4 py-3 text-sm [overflow-wrap:anywhere]">
                {{ t('customer.sent', { email: sentTo() }) }}
                <button type="button" class="ml-1 {{ link }}" (click)="changeEmail()">{{ t('customer.changeEmail') }}</button>
              </p>
              @if (devCode(); as code) {
                <p class="rounded-xl border border-dashed border-amber-500/60 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">{{ t('customer.devCode', { code }) }}</p>
              }
              <div>
                <label for="carta-cu-code" class="block text-sm font-semibold">{{ t('customer.code') }}</label>
                <input
                  id="carta-cu-code"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  pattern="[0-9]*"
                  maxlength="6"
                  [class]="input + ' tracking-[0.4em] tabular-nums'"
                  [value]="code()"
                  [attr.aria-invalid]="!!fieldError()"
                  [attr.aria-describedby]="fieldError() ? 'carta-cu-error' : null"
                  (input)="setCode($any($event.target))"
                />
              </div>
              <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                @if (resendLeft() > 0) {
                  <span class="text-muted-foreground">{{ t('customer.resendIn', { s: resendLeft() }) }}</span>
                } @else {
                  <button type="button" [class]="link" [disabled]="busy()" (click)="resend()">{{ t('customer.resend') }}</button>
                }
              </p>
              <div>
                <label for="carta-cu-name" class="block text-sm font-semibold">{{ t('customer.name') }} <span class="font-normal text-muted-foreground">{{ t('cart.optional') }}</span></label>
                <input id="carta-cu-name" type="text" autocomplete="name" [class]="input" [maxLength]="limits.name" [value]="name()" (input)="name.set($any($event.target).value)" />
              </div>
              @if (cp?.askPhone) {
                <div>
                  <label for="carta-cu-phone" class="block text-sm font-semibold">{{ t('customer.phone') }} <span class="font-normal text-muted-foreground">{{ t('cart.optional') }}</span></label>
                  <input
                    id="carta-cu-phone"
                    type="tel"
                    inputmode="tel"
                    autocomplete="tel"
                    placeholder="+56 9 1234 5678"
                    maxlength="24"
                    [class]="input"
                    [value]="phone()"
                    [attr.aria-invalid]="!!phoneError()"
                    [attr.aria-describedby]="phoneError() ? 'carta-cu-phone-error' : 'carta-cu-phone-hint'"
                    (input)="phone.set($any($event.target).value)"
                  />
                  @if (phoneError(); as e) {
                    <p id="carta-cu-phone-error" class="mt-1 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
                  } @else {
                    <p id="carta-cu-phone-hint" class="mt-1 text-xs text-muted-foreground">{{ t('customer.phoneHint') }}</p>
                  }
                </div>
              }
              @if (reaccept()) {
                <app-carta-legal-consent [businessSlug]="m.business.slug" [businessName]="m.business.name" [localText]="localConsentText()" [privacyUrl]="cp?.privacyUrl ?? null" />
              }
              @if (fieldError() || error(); as e) {
                <p id="carta-cu-error" class="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">{{ e }}</p>
              }
              <button type="submit" [class]="primary" [disabled]="busy()" [attr.aria-busy]="busy() || null">
                {{ busy() ? t('customer.verifying') : t('customer.verify') }}
              </button>
            </form>
          }
          <app-carta-preferences class="mt-8 block border-t border-border pt-5" [tags]="m.tags" (language)="language.emit($event)" />
        } @else {
          @if (blockedMessage() || customer.quotaExceeded()) {
            <p class="mt-2 rounded-2xl bg-muted px-4 py-3 text-sm" role="status">{{ blockedMessage() ?? t('error.OTP_QUOTA_EXCEEDED') }}</p>
          }
          <app-carta-preferences class="mt-4" [tags]="m.tags" (language)="language.emit($event)" />
        }
      }
    </div>
  `,
})
export class CartaProfileSheet {
  readonly menu = input.required<PublicLocationMenuDto>();
  /** Idioma elegido en las preferencias (la carta lo aplica si lo ofrece). */
  readonly language = output<CartaLang>();

  protected readonly customer = inject(CartaCustomer);
  readonly #api = inject(PublicCustomerApiService);
  readonly #i18n = inject(CartaI18n);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #injector = inject(Injector);
  protected readonly t = this.#i18n.t;
  protected readonly tn = this.#i18n.tn;
  protected readonly input = INPUT;
  protected readonly primary = PRIMARY;
  protected readonly link = LINK;
  protected readonly limits = ONLINE_LIMITS;
  readonly #legal = inject(CartaLegal);
  private readonly consent = viewChild(CartaLegalConsent);

  protected readonly canVerify = computed(() => this.customer.verifiedMode());
  /** customerProfiles.consentText solo si es del local (el de Redom lo reemplazan los documentos legales). */
  protected readonly localConsentText = computed(() => {
    const text = this.menu().customerProfiles?.consentText?.trim();
    return text && !text.startsWith(REDOM_CONSENT_START) ? text : null;
  });
  /** Las versiones cambiaron entre pedir y verificar el código: se vuelven a aceptar en el paso del código. */
  protected readonly reaccept = signal(false);
  /** Versiones aceptadas al pedir el código (para reenviarlo). */
  #acceptedIds: number[] = [];
  /** El teléfono del perfil se muestra si el local lo pide o si el cliente ya lo dio. */
  protected readonly showPhone = computed(() => !!this.menu().customerProfiles?.askPhone || !!this.customer.profile()?.phone);

  protected readonly step = signal<Step>('email');
  protected readonly email = signal(this.customer.checkoutDefaults().email);
  /** Correo al que se envió el último código. */
  protected readonly sentTo = signal('');
  protected readonly code = signal('');
  protected readonly name = signal(this.customer.checkoutDefaults().name);
  protected readonly phone = signal(this.customer.checkoutDefaults().phone);
  protected readonly devCode = signal<string | null>(null);
  protected readonly resendLeft = signal(0);
  protected readonly busy = signal(false);
  protected readonly fieldError = signal<string | null>(null);
  protected readonly phoneError = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Para lectores de pantalla: código enviado, sesión iniciada o cerrada. */
  protected readonly status = signal('');
  protected readonly confirmDelete = signal(false);
  /** Cerrar sesión cierra todos los dispositivos: se confirma. */
  protected readonly confirmLogout = signal(false);
  /** Por qué no se pueden pedir códigos (cuota agotada o perfil desactivado). */
  protected readonly blockedMessage = signal<string | null>(null);

  // Edición de nombre y teléfono del perfil
  protected readonly editing = signal(false);
  protected readonly editName = signal('');
  protected readonly editPhone = signal('');

  #timer: ReturnType<typeof setInterval> | null = null;
  #request: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#stopTimer();
      this.#request?.unsubscribe();
    });
  }

  protected sendCode(event: Event): void {
    event.preventDefault();
    const email = this.email().trim().toLowerCase();
    if (!isEmail(email)) {
      this.#clearErrors();
      this.fieldError.set(this.t('customer.err.email'));
      this.#focus('#carta-cu-email');
      return;
    }
    const accepted = this.consent()?.selection() ?? null;
    if (!accepted) return;
    this.#acceptedIds = accepted;
    this.#requestOtp(email);
  }

  protected resend(): void {
    if (this.reaccept()) {
      const accepted = this.consent()?.selection() ?? null;
      if (!accepted) return;
      this.#acceptedIds = accepted;
    }
    this.code.set('');
    this.#requestOtp(this.sentTo());
  }

  protected changeEmail(): void {
    this.#stopTimer();
    this.step.set('email');
    this.reaccept.set(false);
    this.code.set('');
    this.devCode.set(null);
    this.#clearErrors();
    this.#focus('#carta-cu-email');
  }

  protected setCode(el: HTMLInputElement): void {
    const digits = el.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== el.value) el.value = digits;
    this.code.set(digits);
  }

  protected verify(event: Event): void {
    event.preventDefault();
    if (this.busy()) return;
    this.#clearErrors();
    const m = this.menu();
    const phone = m.customerProfiles?.askPhone ? this.phone().trim() : '';
    if (!/^\d{6}$/.test(this.code())) this.fieldError.set(this.t('customer.err.code'));
    let accepted: number[] | null = null;
    if (this.reaccept()) {
      accepted = this.consent()?.selection() ?? null;
      if (!accepted) return;
    }
    if (phone && !validPhone(phone)) this.phoneError.set(this.t('customer.err.phone'));
    if (this.fieldError() || this.error() || this.phoneError()) {
      setTimeout(() => this.#host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const name = this.name().trim().slice(0, ONLINE_LIMITS.name);
    this.busy.set(true);
    this.#request?.unsubscribe();
    this.#request = this.#api
      .verify({
        email: this.sentTo(),
        code: this.code(),
        businessSlug: m.business.slug,
        locationSlug: m.location.slug,
        ...(accepted ? { acceptedVersionIds: accepted } : {}),
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
      })
      .subscribe({
        next: ({ token, customer }) => {
          this.busy.set(false);
          this.#stopTimer();
          this.reaccept.set(false);
          this.customer.signedIn(token, customer);
          this.status.set(this.t('customer.welcome'));
          this.#focus('h2');
        },
        error: (e) => {
          this.busy.set(false);
          this.#otpError(e);
        },
      });
  }

  /** Aceptó los pendientes desde el aviso del perfil. */
  protected legalDone(accepted: boolean): void {
    if (accepted) {
      this.status.set(this.t('legal.accepted'));
      this.#focus('h2');
    }
  }

  protected startEdit(): void {
    const profile = this.customer.profile();
    this.editName.set(profile?.name ?? '');
    this.editPhone.set(profile?.phone ?? '');
    this.#clearErrors();
    this.editing.set(true);
    this.#focus('#carta-cu-edit-name');
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.#clearErrors();
    this.#focus('#carta-cu-edit');
  }

  protected saveData(event: Event): void {
    event.preventDefault();
    if (this.busy()) return;
    this.#clearErrors();
    const name = this.editName().trim().slice(0, ONLINE_LIMITS.name);
    const phone = this.editPhone().trim();
    if (this.showPhone() && phone && !validPhone(phone)) {
      this.phoneError.set(this.t('customer.err.phone'));
      this.#focus('#carta-cu-edit-phone');
      return;
    }
    this.busy.set(true);
    this.#request?.unsubscribe();
    this.#request = this.customer.updateProfile({ name: name || null, ...(this.showPhone() ? { phone: phone || null } : {}) }).subscribe({
      next: (customer) => {
        this.busy.set(false);
        if (customer) this.customer.applyProfile(customer);
        this.editing.set(false);
        this.status.set(this.t('customer.dataSaved'));
        this.#focus('#carta-cu-edit');
      },
      error: (e) => {
        this.busy.set(false);
        if (readApiError(e).code === 'PHONE_INVALID') {
          this.phoneError.set(cartaErrorMessage(e));
          this.#focus('#carta-cu-edit-phone');
        } else this.error.set(cartaErrorMessage(e));
      },
    });
  }

  protected askLogout(): void {
    this.confirmDelete.set(false);
    this.confirmLogout.set(true);
    this.#focus('#carta-logout-yes');
  }

  protected cancelLogout(): void {
    this.confirmLogout.set(false);
    this.#focus('#carta-logout');
  }

  protected logout(): void {
    this.confirmLogout.set(false);
    this.customer.logout();
    this.#reset();
    this.status.set(this.t('customer.loggedOut'));
    this.#focus('h2');
  }

  protected askDelete(): void {
    this.error.set(null);
    this.confirmLogout.set(false);
    this.confirmDelete.set(true);
    this.#focus('button.bg-rose-600');
  }

  protected deleteData(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.#request?.unsubscribe();
    this.#request = this.customer.deleteMe().subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmDelete.set(false);
        this.#reset();
        this.email.set('');
        this.name.set('');
        this.phone.set('');
        this.status.set(this.t('customer.deleted'));
        this.#focus('h2');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(cartaErrorMessage(e));
      },
    });
  }

  #requestOtp(email: string): void {
    if (this.busy()) return;
    this.#clearErrors();
    const m = this.menu();
    this.busy.set(true);
    this.#request?.unsubscribe();
    this.#request = this.#api
      .requestOtp({
        email,
        language: this.#i18n.language(),
        businessSlug: m.business.slug,
        locationSlug: m.location.slug,
        acceptedVersionIds: this.#acceptedIds,
      })
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.#codeSent(result, email);
        },
        error: (e) => {
          this.busy.set(false);
          this.#otpError(e);
        },
      });
  }

  #codeSent(result: OtpRequestResultDto, email: string): void {
    this.sentTo.set(email);
    this.devCode.set(typeof result.devCode === 'string' ? result.devCode : null);
    const wasEmail = this.step() === 'email';
    this.step.set('code');
    this.#startTimer(Number(result.resendIn) || 30);
    this.status.set(this.t('customer.sent', { email }));
    if (wasEmail) this.#focus('#carta-cu-code');
  }

  #otpError(error: unknown): void {
    const api = readApiError(error);
    if (api.code === 'OTP_QUOTA_EXCEEDED' || this.customer.handleDisabled(error)) {
      // El local no puede enviar códigos (o dejó de reconocer clientes): queda el modo navegador en la visita
      if (api.code === 'OTP_QUOTA_EXCEEDED') this.customer.quotaExceeded.set(true);
      this.#reset();
      this.blockedMessage.set(cartaErrorMessage(error));
      this.status.set(cartaErrorMessage(error));
      return;
    }
    const message = cartaErrorMessage(error);
    if (api.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
      // Cambió una versión vigente: se vuelven a mostrar los documentos y se pide la casilla otra vez
      this.error.set(this.t('legal.changed'));
      this.#acceptedIds = [];
      if (this.step() === 'email' || this.reaccept()) this.consent()?.reload(true);
      else {
        this.#legal.forget();
        this.reaccept.set(true);
      }
      return;
    }
    if (api.code === 'EMAIL_INVALID') {
      // El correo se corrige en el primer paso
      this.changeEmail();
      this.fieldError.set(message);
      return;
    }
    if (api.code === 'PHONE_INVALID') {
      this.phoneError.set(message);
      this.#focus('#carta-cu-phone');
      return;
    }
    if (api.code === 'OTP_INVALID') {
      const left = Number(api.details['attemptsLeft']);
      this.fieldError.set(Number.isInteger(left) && left > 0 ? `${message} ${this.tn('customer.attemptsLeft', left)}` : message);
      return;
    }
    if (api.code === 'OTP_RATE_LIMITED') {
      const retryAt = Date.parse(String(api.details['retryAt'] ?? ''));
      const wait = Number.isFinite(retryAt) ? Math.ceil((retryAt - Date.now()) / 1000) : 0;
      this.error.set(wait > 0 ? `${message} ${this.t('customer.retryAt', { time: retryTime(retryAt) })}` : message);
      if (this.step() === 'code') this.#startTimer(wait);
      return;
    }
    this.error.set(message);
    // Código vencido, usado o con demasiados intentos: se pide uno nuevo; sin servicio se puede reintentar al tiro
    if (api.code === 'OTP_EXPIRED' || api.code === 'OTP_TOO_MANY_ATTEMPTS') this.code.set('');
    if (api.code === 'OTP_EXPIRED' || api.code === 'OTP_TOO_MANY_ATTEMPTS' || api.code === 'OTP_UNAVAILABLE') this.#startTimer(0);
  }

  #startTimer(seconds: number): void {
    this.#stopTimer();
    this.resendLeft.set(Math.max(0, Math.min(seconds, 600)));
    if (this.resendLeft() <= 0) return;
    this.#timer = setInterval(() => {
      this.resendLeft.update((s) => Math.max(0, s - 1));
      if (this.resendLeft() === 0) this.#stopTimer();
    }, 1000);
  }

  #stopTimer(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  #reset(): void {
    this.#stopTimer();
    this.confirmLogout.set(false);
    this.step.set('email');
    this.code.set('');
    this.reaccept.set(false);
    this.#acceptedIds = [];
    this.devCode.set(null);
    this.resendLeft.set(0);
    this.editing.set(false);
    this.#clearErrors();
  }

  #clearErrors(): void {
    this.fieldError.set(null);
    this.phoneError.set(null);
    this.error.set(null);
  }

  #focus(selector: string): void {
    afterNextRender(() => this.#host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.#injector });
  }
}

/** Teléfono opcional (no se verifica), como lo acepta el backend: móvil chileno de 9 dígitos (con o sin +56) o internacional con +. */
function validPhone(phone: string): boolean {
  const compact = phone.trim().replace(/[\s().-]/g, '');
  return /^(?:\+?56)?9\d{8}$/.test(compact) || (/^\+[1-9]\d{7,14}$/.test(compact) && !compact.startsWith('+56'));
}

/** Hora (y día, si no es hoy) en que se puede pedir otro código. */
function retryTime(at: number): string {
  const date = new Date(at);
  const today = date.toDateString() === new Date().toDateString();
  const options: Intl.DateTimeFormatOptions = today ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat(cartaLocale(), options).format(date);
}
