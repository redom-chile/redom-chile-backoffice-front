import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnInit,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import type { AcceptedDocumentDto, LegalVersionDto, PendingDocumentDto } from 'src/app/core/services/legal/dtos';
import { renderMarkdown } from 'src/app/modules/help/ui/markdown/markdown';
import { readApiError } from 'src/app/core/utils/api-error';
import { MARKETING_CONSENT_CODE } from '../../data-access/dtos/customer-profiles.dto';
import { CartaCustomer } from '../carta-customer';
import { CartaI18n, CartaKey, cartaErrorMessage, cartaLocale } from '../carta-i18n';
import { CartaLegal, DinerDocuments } from '../carta-legal';
import { safeUrl } from '../carta-marketing';
import { CartaDialog } from './carta-dialog';
import { CartaIcon } from './carta-icon';

const LINK = 'font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const SMALL_BUTTON =
  'shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const PRIMARY =
  'rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const ERROR = 'text-sm font-medium text-rose-600 dark:text-rose-400';

/** Markdown del documento (sin la extensión de tipografía en la landing). */
const MARKDOWN_CSS = `
.carta-legal-md { overflow-wrap: anywhere; line-height: 1.6; }
.carta-legal-md > :first-child { margin-top: 0; }
.carta-legal-md :where(h1, h2, h3, h4) { margin: 1.25em 0 0.5em; font-weight: 700; line-height: 1.3; }
.carta-legal-md :where(h1) { font-size: 1.25rem; }
.carta-legal-md :where(h2) { font-size: 1.125rem; }
.carta-legal-md :where(h3, h4) { font-size: 1rem; }
.carta-legal-md :where(p, ul, ol, blockquote, table) { margin: 0.75em 0; }
.carta-legal-md :where(ul) { list-style: disc; padding-left: 1.25rem; }
.carta-legal-md :where(ol) { list-style: decimal; padding-left: 1.25rem; }
.carta-legal-md :where(li) { margin: 0.25em 0; }
.carta-legal-md :where(a) { color: var(--primary); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.carta-legal-md :where(blockquote) { border-left: 3px solid var(--border); padding-left: 0.75rem; color: var(--muted-foreground); }
.carta-legal-md :where(table) { display: block; overflow-x: auto; border-collapse: collapse; }
.carta-legal-md :where(th, td) { border: 1px solid var(--border); padding: 0.25rem 0.5rem; text-align: left; }
.carta-legal-md :where(hr) { margin: 1.25em 0; border-color: var(--border); }
.carta-legal-md :where(code) { font-size: 0.875em; }
`;

let nextId = 0;
const uid = (prefix: string) => `${prefix}-${++nextId}`;

/** Fecha corta en el idioma de la carta. */
function legalDate(value: string | null | undefined): string {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(cartaLocale(), { dateStyle: 'medium' }).format(date) : '';
}

/** Una versión de un documento: título, versión, vigencia, PDF y el texto (markdown sin HTML). */
@Component({
  selector: 'app-carta-legal-document',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [MARKDOWN_CSS],
  host: { class: 'block' },
  template: `
    <div class="px-5 pb-6 pt-5">
      @if (doc(); as d) {
        <h2 tabindex="-1" class="pr-10 text-xl font-bold tracking-tight outline-none">{{ d.title }}</h2>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ t('legal.version', { n: d.version }) }}
          @if (date(d.effectiveAt); as when) {
            · {{ t('legal.effective', { date: when }) }}
          }
        </p>
        @if (!d.isCurrent) {
          <p class="mt-2 rounded-xl bg-muted px-3 py-2 text-xs" role="note">{{ t('legal.retired') }}</p>
        }
        @if (pdf(); as href) {
          <a [href]="href" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex items-center gap-1.5 text-sm {{ link }}">
            <app-carta-icon name="external" [size]="16" />
            {{ t('legal.pdf') }}<span class="sr-only"> {{ t('common.newTab') }}</span>
          </a>
        }
        <div class="carta-legal-md mt-4 text-sm" [innerHTML]="html()" (click)="openLink($event)"></div>
      } @else {
        <h2 tabindex="-1" class="pr-10 text-xl font-bold tracking-tight outline-none">{{ title() || t('legal.docs') }}</h2>
        @if (failed()) {
          <p class="mt-3 {{ error }}" role="alert">{{ t('legal.docError') }}</p>
          <button type="button" class="mt-3 {{ small }}" (click)="load()">{{ t('common.retry') }}</button>
        } @else {
          <p class="mt-3 text-sm text-muted-foreground" role="status">{{ t('legal.docLoading') }}</p>
        }
      }
    </div>
  `,
})
export class CartaLegalDocument implements OnInit {
  readonly versionId = input.required<number>();
  /** Mientras carga. */
  readonly title = input('');

  readonly #legal = inject(CartaLegal);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #injector = inject(Injector);
  protected readonly t = inject(CartaI18n).t;
  protected readonly link = LINK;
  protected readonly small = SMALL_BUTTON;
  protected readonly error = ERROR;
  protected readonly date = legalDate;

  protected readonly doc = signal<LegalVersionDto | null>(null);
  protected readonly failed = signal(false);
  protected readonly html = computed(() => renderMarkdown(this.doc()?.content));
  protected readonly pdf = computed(() => safeUrl(this.doc()?.pdfUrl ?? null));
  #sub: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#sub?.unsubscribe());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.failed.set(false);
    this.#sub?.unsubscribe();
    this.#sub = this.#legal.version(this.versionId()).subscribe({
      next: (doc) => {
        this.doc.set(doc);
        afterNextRender(() => this.#host.nativeElement.querySelector<HTMLElement>('h2')?.focus(), { injector: this.#injector });
      },
      error: () => this.failed.set(true),
    });
  }

  /** Los enlaces del documento se abren en otra pestaña (nunca dentro de la carta). */
  protected openLink(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    const href = anchor?.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    if (/^(https?:|mailto:)/i.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
  }
}

/** Botón (o enlace) que abre una versión en una hoja encima de la actual. No va dentro de un <label>. */
@Component({
  selector: 'app-carta-legal-read',
  imports: [CartaDialog, CartaLegalDocument],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline' },
  template: `<button type="button" aria-haspopup="dialog" [class]="buttonClass()" [attr.aria-label]="ariaLabel() || null" (click)="open.set(true)">{{ label() || t('legal.read') }}</button>@if (open()) {
      <app-carta-dialog [label]="title()" (closed)="open.set(false)">
        <app-carta-legal-document [versionId]="versionId()" [title]="title()" />
      </app-carta-dialog>
    }`,
})
export class CartaLegalRead {
  readonly versionId = input.required<number>();
  readonly title = input.required<string>();
  readonly label = input('');
  readonly ariaLabel = input('');
  readonly buttonClass = input(SMALL_BUTTON);

  protected readonly t = inject(CartaI18n).t;
  protected readonly open = signal(false);
}

/**
 * Antes del correo en "Tu perfil": dinerTerms, privacyPolicy y dinerDataConsent vigentes (los sin versión publicada se
 * omiten) con una casilla obligatoria, y marketingConsent del negocio (opcional) si existe. El texto propio del local se
 * sigue mostrando.
 */
@Component({
  selector: 'app-carta-legal-consent',
  imports: [CartaLegalRead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <fieldset class="grid gap-3">
      <legend class="mb-1 text-sm font-semibold">{{ t('legal.docs') }}</legend>
      @if (failed()) {
        <p class="{{ error }}" role="alert">{{ t('legal.loadError') }}</p>
        <button type="button" class="justify-self-start {{ small }}" (click)="reload()">{{ t('common.retry') }}</button>
      } @else if (docs(); as d) {
        @if (changed()) {
          <p class="rounded-xl bg-amber-500/10 px-3 py-2 text-sm font-medium" role="alert">{{ t('legal.changed') }}</p>
        }
        @if (d.required.length) {
          <p class="text-xs text-muted-foreground">{{ t('legal.intro') }}</p>
          <ul class="divide-y divide-border rounded-2xl border border-border" [attr.aria-label]="t('legal.docs')">
            @for (doc of d.required; track doc.versionId) {
              <li class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span class="[overflow-wrap:anywhere]">{{ doc.title }}</span>
                <app-carta-legal-read [versionId]="doc.versionId" [title]="doc.title" [ariaLabel]="t('legal.readTitle', { title: doc.title })" />
              </li>
            }
          </ul>
          <label class="flex cursor-pointer items-start gap-3 text-sm">
            <input
              [id]="ids.required"
              type="checkbox"
              class="mt-0.5 size-4 shrink-0 accent-primary"
              [checked]="required()"
              [attr.aria-invalid]="!!requiredError() || null"
              [attr.aria-describedby]="requiredError() ? ids.error : null"
              (change)="setRequired($any($event.target).checked)"
            />
            <span>{{ t('legal.acceptRequired') }}</span>
          </label>
        }
        @if (d.marketing; as mk) {
          <div class="flex items-start justify-between gap-3">
            <label class="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" class="mt-0.5 size-4 shrink-0 accent-primary" [checked]="marketing()" (change)="marketing.set($any($event.target).checked)" />
              <span>{{ t('legal.marketing', { business: businessName() }) }}</span>
            </label>
            <app-carta-legal-read [versionId]="mk.versionId" [title]="mk.title" [ariaLabel]="t('legal.readTitle', { title: mk.title })" />
          </div>
        }
        @if (requiredError(); as e) {
          <p [id]="ids.error" class="{{ error }}" role="alert">{{ e }}</p>
        }
      } @else {
        <p class="text-sm text-muted-foreground" role="status">{{ t('legal.loading') }}</p>
      }
      @if (localText() || privacy()) {
        <div class="rounded-2xl bg-muted px-4 py-3 text-xs">
          @if (localText(); as text) {
            <p class="font-semibold">{{ t('legal.localText') }}</p>
            <p class="mt-1 [overflow-wrap:anywhere]">{{ text }}</p>
          }
          @if (privacy(); as href) {
            <a [href]="href" target="_blank" rel="noopener noreferrer" class="mt-1 inline-block {{ link }}">{{ t('legal.privacyBusiness') }}<span class="sr-only"> {{ t('common.newTab') }}</span></a>
          }
        </div>
      }
    </fieldset>
  `,
})
export class CartaLegalConsent implements OnInit {
  readonly businessSlug = input.required<string>();
  readonly businessName = input.required<string>();
  /** customerProfiles.consentText cuando es del local. */
  readonly localText = input<string | null>(null);
  readonly privacyUrl = input<string | null>(null);

  readonly #legal = inject(CartaLegal);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #injector = inject(Injector);
  protected readonly t = inject(CartaI18n).t;
  protected readonly link = LINK;
  protected readonly small = SMALL_BUTTON;
  protected readonly error = ERROR;
  protected readonly ids = { required: uid('carta-legal-required'), error: uid('carta-legal-error') };

  protected readonly docs = signal<DinerDocuments | null>(null);
  protected readonly failed = signal(false);
  protected readonly required = signal(false);
  protected readonly marketing = signal(false);
  protected readonly requiredError = signal<string | null>(null);
  /** Las versiones cambiaron (LEGAL_ACCEPTANCE_REQUIRED): se avisa y se vuelve a pedir la casilla. */
  protected readonly changed = signal(false);
  protected readonly privacy = computed(() => safeUrl(this.privacyUrl()));
  #sub: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#sub?.unsubscribe());
  }

  ngOnInit(): void {
    this.reload();
  }

  /** changed: los documentos cambiaron en el servidor (se descartan los guardados y se desmarca la casilla). */
  reload(changed = false): void {
    if (changed) this.#legal.forget();
    this.changed.set(changed);
    this.required.set(false);
    this.requiredError.set(null);
    this.failed.set(false);
    this.docs.set(null);
    this.#sub?.unsubscribe();
    this.#sub = this.#legal.dinerDocuments(this.businessSlug()).subscribe({
      next: (docs) => this.docs.set(docs),
      error: () => this.failed.set(true),
    });
  }

  /** Versiones a enviar (obligatorias y marketing si se marcó); null si falta la casilla o los documentos. */
  selection(): number[] | null {
    const docs = this.docs();
    if (!docs) {
      if (!this.failed()) this.requiredError.set(this.t('legal.loading'));
      return null;
    }
    if (docs.required.length && !this.required()) {
      this.requiredError.set(this.t('legal.err.required'));
      afterNextRender(() => this.#host.nativeElement.querySelector<HTMLElement>(`#${this.ids.required}`)?.focus(), { injector: this.#injector });
      return null;
    }
    this.requiredError.set(null);
    return [...docs.required.map((d) => d.versionId), ...(docs.marketing && this.marketing() ? [docs.marketing.versionId] : [])];
  }

  protected setRequired(checked: boolean): void {
    this.required.set(checked);
    if (checked) this.requiredError.set(null);
  }
}

/** Documentos que el cliente identificado debe volver a aceptar (cambio de versión). */
@Component({
  selector: 'app-carta-legal-pending',
  imports: [CartaLegalRead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-3" [attr.aria-labelledby]="ids.title">
      <h3 [id]="ids.title" tabindex="-1" class="text-base font-semibold outline-none">{{ t('legal.pendingTitle') }}</h3>
      <p class="mt-1 text-sm">{{ t('legal.pendingIntro') }}</p>
      <ul class="mt-3 grid gap-2" [attr.aria-label]="t('legal.docs')">
        @for (doc of documents(); track doc.versionId) {
          <li class="flex items-center justify-between gap-3 text-sm">
            <span class="[overflow-wrap:anywhere]">
              {{ doc.title }}
              @if (doc.isMaterialChange) {
                <span class="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold">{{ t('legal.material') }}</span>
              }
            </span>
            <app-carta-legal-read [versionId]="doc.versionId" [title]="doc.title" [ariaLabel]="t('legal.readTitle', { title: doc.title })" />
          </li>
        }
      </ul>
      <label class="mt-3 flex cursor-pointer items-start gap-3 text-sm">
        <input
          [id]="ids.check"
          type="checkbox"
          class="mt-0.5 size-4 shrink-0 accent-primary"
          [checked]="checked()"
          [attr.aria-invalid]="invalid() || null"
          [attr.aria-describedby]="error() ? ids.error : null"
          (change)="setChecked($any($event.target).checked)"
        />
        <span>{{ t('legal.pendingAccept') }}</span>
      </label>
      @if (error(); as e) {
        <p [id]="ids.error" class="mt-2 {{ errorClass }}" role="alert">{{ e }}</p>
      }
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" [class]="primary" [disabled]="busy()" [attr.aria-busy]="busy() || null" (click)="accept()">
          {{ busy() ? t('legal.accepting') : t('legal.accept') }}
        </button>
        @if (dismissible()) {
          <button type="button" class="rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted" (click)="done.emit(false)">
            {{ t('legal.later') }}
          </button>
        }
      </div>
    </section>
  `,
})
export class CartaLegalPending {
  readonly documents = input.required<readonly PendingDocumentDto[]>();
  readonly dismissible = input(false);
  /** true: los aceptó. */
  readonly done = output<boolean>();

  readonly #customer = inject(CartaCustomer);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #injector = inject(Injector);
  protected readonly t = inject(CartaI18n).t;
  protected readonly primary = PRIMARY;
  protected readonly errorClass = ERROR;
  protected readonly ids = { title: uid('carta-legal-pending'), check: uid('carta-legal-pending-check'), error: uid('carta-legal-pending-error') };

  protected readonly checked = signal(false);
  protected readonly invalid = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  #sub: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#sub?.unsubscribe());
  }

  protected setChecked(checked: boolean): void {
    this.checked.set(checked);
    if (checked) {
      this.invalid.set(false);
      this.error.set(null);
    }
  }

  protected accept(): void {
    if (this.busy()) return;
    if (!this.checked()) {
      this.invalid.set(true);
      this.error.set(this.t('legal.err.required'));
      this.#focus(`#${this.ids.check}`);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.#sub?.unsubscribe();
    this.#sub = this.#customer.acceptLegal(this.documents().map((d) => d.versionId)).subscribe({
      next: () => {
        this.busy.set(false);
        this.checked.set(false);
        this.done.emit(true);
      },
      error: (e) => {
        this.busy.set(false);
        // Otra versión quedó vigente: la lista se recarga y se vuelve a pedir la casilla
        if (readApiError(e).code === 'LEGAL_VERSION_NOT_PUBLISHED') this.checked.set(false);
        this.error.set(cartaErrorMessage(e));
        this.#focus(`#${this.ids.title}`);
      },
    });
  }

  #focus(selector: string): void {
    afterNextRender(() => this.#host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.#injector });
  }
}

const ACTION_KEYS: Readonly<Record<AcceptedDocumentDto['action'], CartaKey>> = {
  accept: 'legal.action.accept',
  withdraw: 'legal.action.withdraw',
  acknowledge: 'legal.action.acknowledge',
};
const VISIBLE_DOCUMENTS = 8;

/** "Mis documentos": historial (cada versión exacta) y las novedades del negocio (marketingConsent), que se pueden retirar. */
@Component({
  selector: 'app-carta-my-documents',
  imports: [CartaLegalRead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section [attr.aria-labelledby]="ids.title">
      <h3 [id]="ids.title" class="text-base font-semibold">{{ t('legal.myDocs') }}</h3>
      <p class="sr-only" aria-live="polite">{{ status() }}</p>
      @if (marketingDoc(); as mk) {
        <div class="mt-3 rounded-2xl border border-border px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <label [for]="ids.marketing" class="text-sm font-medium">{{ t('legal.marketingTitle', { business: businessName() }) }}</label>
            <input
              [id]="ids.marketing"
              type="checkbox"
              role="switch"
              class="size-5 shrink-0 accent-primary"
              [checked]="marketingOn()"
              [disabled]="busy()"
              [attr.aria-busy]="busy() || null"
              [attr.aria-describedby]="error() ? ids.error : null"
              (change)="toggleMarketing($any($event.target))"
            />
          </div>
          <p class="mt-1 text-xs">
            <app-carta-legal-read [versionId]="mk.versionId" [title]="mk.title" [label]="mk.title" [buttonClass]="link" />
          </p>
        </div>
      }
      @if (error(); as e) {
        <p [id]="ids.error" class="mt-2 {{ errorClass }}" role="alert">{{ e }}</p>
      }
      @if (customer.legal(); as legal) {
        @if (legal.accepted.length) {
          <ul class="mt-3 divide-y divide-border rounded-2xl border border-border">
            @for (doc of visible(); track $index) {
              <li class="flex items-center justify-between gap-3 px-4 py-2.5">
                <div class="min-w-0 text-sm">
                  <p class="font-medium [overflow-wrap:anywhere]">{{ doc.title }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ t('legal.version', { n: doc.version }) }} · {{ t(actionKeys[doc.action]) }} · {{ date(doc.createdAt) }}
                  </p>
                </div>
                <app-carta-legal-read
                  [versionId]="doc.versionId"
                  [title]="doc.title"
                  [label]="t('legal.view')"
                  [ariaLabel]="t('legal.viewTitle', { title: doc.title, n: doc.version })"
                />
              </li>
            }
          </ul>
          @if (!showAll() && legal.accepted.length > maxVisible) {
            <button type="button" class="mt-2 text-sm {{ link }}" (click)="showAll.set(true)">{{ t('legal.showAll', { n: legal.accepted.length }) }}</button>
          }
        } @else {
          <p class="mt-2 text-sm text-muted-foreground">{{ t('legal.myDocsEmpty') }}</p>
        }
      } @else {
        <p class="mt-2 text-sm text-muted-foreground" role="status">{{ t('legal.myDocsLoading') }}</p>
      }
      <p class="mt-2 text-xs text-muted-foreground">{{ t('legal.requiredNote') }}</p>
    </section>
  `,
})
export class CartaMyDocuments implements OnInit {
  readonly businessSlug = input.required<string>();
  readonly businessName = input.required<string>();

  protected readonly customer = inject(CartaCustomer);
  readonly #legal = inject(CartaLegal);
  protected readonly t = inject(CartaI18n).t;
  protected readonly link = LINK;
  protected readonly errorClass = ERROR;
  protected readonly actionKeys = ACTION_KEYS;
  protected readonly maxVisible = VISIBLE_DOCUMENTS;
  protected readonly date = legalDate;
  protected readonly ids = { title: uid('carta-legal-docs'), marketing: uid('carta-legal-marketing'), error: uid('carta-legal-docs-error') };

  protected readonly marketingDoc = signal<LegalVersionDto | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal('');
  protected readonly showAll = signal(false);
  protected readonly visible = computed(() => {
    const accepted = this.customer.legal()?.accepted ?? [];
    return this.showAll() ? accepted : accepted.slice(0, VISIBLE_DOCUMENTS);
  });

  /**
   * Último registro de marketingConsent de este negocio (el historial llega del más nuevo al más antiguo). El negocio se
   * reconoce por el businessId del registro de la versión vigente; si no hay, por el título del documento.
   */
  protected readonly marketingOn = computed(() => {
    const mk = this.marketingDoc();
    if (!mk) return false;
    const entries = (this.customer.legal()?.accepted ?? []).filter((a) => a.documentCode === MARKETING_CONSENT_CODE);
    const anchor = entries.find((a) => a.versionId === mk.versionId);
    const mine = anchor ? entries.filter((a) => a.businessId === anchor.businessId) : entries.filter((a) => a.title === mk.title);
    return mine[0]?.action === 'accept';
  });
  #subs = new Subscription();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#subs.unsubscribe());
  }

  ngOnInit(): void {
    this.#subs.add(
      this.#legal.document(MARKETING_CONSENT_CODE, this.businessSlug()).subscribe({
        next: (doc) => this.marketingDoc.set(doc),
        error: () => this.marketingDoc.set(null),
      }),
    );
  }

  protected toggleMarketing(el: HTMLInputElement): void {
    const mk = this.marketingDoc();
    if (!mk || this.busy()) return;
    const on = el.checked;
    const slug = this.businessSlug();
    this.busy.set(true);
    this.error.set(null);
    const request = on ? this.customer.acceptLegal([mk.versionId], slug) : this.customer.withdrawLegal(MARKETING_CONSENT_CODE, slug);
    this.#subs.add(
      request.subscribe({
        next: () => {
          this.busy.set(false);
          this.status.set(this.t('legal.marketingSaved'));
        },
        error: (e) => {
          this.busy.set(false);
          el.checked = this.marketingOn();
          if (readApiError(e).code === 'LEGAL_VERSION_NOT_PUBLISHED') {
            // Hay otra versión vigente: se vuelve a leer para mostrarla
            this.#legal.forget(MARKETING_CONSENT_CODE);
            this.ngOnInit();
          }
          this.error.set(cartaErrorMessage(e));
        },
      }),
    );
  }
}

/** Pedidos sin perfil y reservas: "Tratamos tus datos según la Política de privacidad" (versión que se envía). */
@Component({
  selector: 'app-carta-privacy-notice',
  imports: [CartaLegalRead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (legal.privacy(); as doc) {
      <p class="text-xs text-muted-foreground">
        {{ t('legal.privacyBefore') }} <app-carta-legal-read [versionId]="doc.versionId" [title]="doc.title" [label]="t('legal.privacyLink')" [buttonClass]="link" />{{
          t('legal.privacyAfter')
        }}
      </p>
    }
  `,
})
export class CartaPrivacyNotice {
  protected readonly legal = inject(CartaLegal);
  protected readonly t = inject(CartaI18n).t;
  protected readonly link = LINK;

  constructor() {
    this.legal.loadPrivacy();
  }
}
