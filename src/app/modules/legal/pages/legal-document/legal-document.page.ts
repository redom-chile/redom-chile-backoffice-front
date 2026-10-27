import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, EMPTY, Observable, of, switchMap } from 'rxjs';
import {
  LegalApiService,
  legalErrorMessage,
  LegalMeDto,
  LegalVersionDto,
  PendingDocumentDto,
} from 'src/app/core/services/legal';
import { readApiError } from 'src/app/core/utils/api-error';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { MarkdownComponent } from 'src/app/modules/help/ui/markdown';
import { AuthService } from 'src/app/modules/auth/pages/data-access';
import { SessionDto } from 'src/app/modules/auth/pages/dtos';
import { ButtonComponent, IconComponent, RedomLogoComponent, ToastService } from 'src/ui';
import { formatLegalDate, languageLabel } from '../../ui';

/**
 * Lectura pública de un documento legal: la versión vigente (o una exacta con ?version=), con su PDF y sus idiomas.
 * Es el enlace de los correos de aviso. Con sesión y el documento pendiente, se puede aceptar aquí mismo.
 */
@Component({
  selector: 'app-legal-document-page',
  imports: [RouterLink, MarkdownComponent, ButtonComponent, IconComponent, RedomLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-background text-foreground min-h-dvh">
      <header class="border-[var(--border)] border-b">
        <div class="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <a routerLink="/" class="inline-flex" aria-label="Ir a Redom"
            ><app-redom-logo class="[--redom-logo-size:1.5rem]"
          /></a>
          <a
            [routerLink]="$loggedIn() ? '/' : '/auth/sign-in'"
            class="text-primary text-sm font-semibold hover:underline">
            {{ $loggedIn() ? 'Volver a Redom' : 'Iniciar sesión' }}
          </a>
        </div>
      </header>

      <main class="mx-auto max-w-3xl px-4 py-8">
        @if ($version(); as version) {
        <article aria-labelledby="legal-document-title">
          <h1 id="legal-document-title" class="text-2xl font-semibold sm:text-3xl">{{ version.title }}</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Versión {{ version.version }} @if (date(version.effectiveAt); as effective) { · vigente desde el
            {{ effective }} }
          </p>

          @if (!version.isCurrent) {
          <div
            class="bg-amber-500/15 mt-4 flex items-start gap-2 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300"
            role="status">
            <app-icon class="h-5 w-5 shrink-0" aria-hidden="true">history</app-icon>
            <p>
              Esta no es la versión vigente{{ version.status === 'retired' ? ' (fue retirada)' : '' }}.
              <a class="font-semibold underline" [routerLink]="[]" [queryParams]="{ lang: version.language }"
                >Ver la versión vigente</a
              >
            </p>
          </div>
          }

          <div class="mt-4 flex flex-wrap items-center gap-3">
            @if (version.languages.length > 1) {
            <label class="flex items-center gap-2 text-sm">
              <span class="text-muted-foreground">Idioma</span>
              <select
                class="glass-input rounded-md px-2 py-1.5"
                [value]="version.language"
                (change)="changeLanguage($any($event.target).value)">
                @for (language of version.languages; track language) {
                <option [value]="language">{{ label(language) }}</option>
                }
              </select>
            </label>
            } @if (version.pdfUrl) {
            <a
              class="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              [href]="version.pdfUrl"
              target="_blank"
              rel="noopener noreferrer">
              <app-icon class="h-4 w-4" aria-hidden="true">picture_as_pdf</app-icon> Descargar PDF
            </a>
            }
          </div>

          @if (version.changeSummary) {
          <p class="bg-primary/5 border-[var(--border)] mt-4 rounded-xl border p-3 text-sm">
            <span class="font-semibold">Qué cambió:</span> {{ version.changeSummary }}
          </p>
          }

          <div class="mt-6">
            <app-markdown [content]="version.content" size="base" />
          </div>

          @if ($pending(); as pending) {
          <div
            class="glass sticky bottom-4 mt-8 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm">Tienes pendiente aceptar este documento.</p>
            <app-button
              type="button"
              impact="bold"
              tone="primary"
              [disabled]="$accepting()"
              [isLoading]="$accepting()"
              (buttonClick)="accept(pending)">
              Aceptar
            </app-button>
          </div>
          }
        </article>
        } @else if ($error(); as error) {
        <div class="mx-auto max-w-md py-16 text-center" role="alert">
          <p class="text-lg font-semibold">{{ error }}</p>
          <a routerLink="/" class="text-primary mt-3 inline-block text-sm font-semibold hover:underline">Ir a Redom</a>
        </div>
        } @else {
        <div class="space-y-3" aria-busy="true" aria-label="Cargando documento">
          <div class="bg-muted/40 h-8 w-2/3 animate-pulse rounded"></div>
          @for (line of [1, 2, 3, 4, 5, 6]; track line) {
          <div class="bg-muted/40 h-3 animate-pulse rounded"></div>
          }
        </div>
        }
      </main>
    </div>
  `,
})
export class LegalDocumentPage {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #api = inject(LegalApiService);
  readonly #auth = inject(AuthService);
  readonly #whoami = inject(WhoamiService);
  readonly #toast = inject(ToastService);
  readonly #title = inject(Title);
  readonly #destroyRef = inject(DestroyRef);

  readonly $version = signal<LegalVersionDto | null>(null);
  readonly $error = signal<string | null>(null);
  readonly $loggedIn = signal(this.#auth.isLogin());
  readonly $accepting = signal(false);
  readonly #pending = signal<readonly PendingDocumentDto[]>([]);
  /** El pendiente de este documento (con sesión), para ofrecer "Aceptar". */
  readonly $pending = computed(() => {
    const version = this.$version();
    if (!version?.isCurrent) return null;
    return this.#pending().find((document) => document.documentCode === version.documentCode) ?? null;
  });

  readonly date = formatLegalDate;
  readonly label = languageLabel;

  constructor() {
    combineLatest([this.#route.paramMap, this.#route.queryParamMap])
      .pipe(
        switchMap(() => {
          this.$version.set(null);
          this.$error.set(null);
          return this.#request().pipe(catchError((error: unknown) => (this.$error.set(this.#errorText(error)), EMPTY)));
        }),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((version) => this.#show(version));
    this.#loadPending();
  }

  changeLanguage(lang: string) {
    this.#router.navigate([], { queryParams: { lang }, replaceUrl: true });
  }

  accept(document: PendingDocumentDto) {
    if (this.$accepting()) return;
    this.$accepting.set(true);
    this.#api.accept<SessionDto>([document.versionId]).subscribe({
      next: (result) => {
        this.$accepting.set(false);
        this.#pending.set(result.pending);
        // Era lo último de una sesión restringida: llega la sesión normal.
        if (result.session) this.#auth.startSession(result.session);
        else this.#whoami.refetch();
        this.#toast.show('Documento aceptado', 'success');
      },
      error: (error: unknown) => {
        this.$accepting.set(false);
        this.#toast.show(
          legalErrorMessage(error) ?? 'No pudimos registrar tu aceptación. Inténtalo de nuevo.',
          'error',
        );
        this.#reload();
        this.#loadPending();
      },
    });
  }

  #reload() {
    this.#request()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (version) => this.#show(version),
        error: (error: unknown) => this.$error.set(this.#errorText(error)),
      });
  }

  /** La versión exacta (?version=) o la vigente en el idioma pedido (?lang=). */
  #request(): Observable<LegalVersionDto> {
    const code = this.#route.snapshot.paramMap.get('code') ?? '';
    const query = this.#route.snapshot.queryParamMap;
    const versionId = Number(query.get('version'));
    return Number.isInteger(versionId) && versionId > 0
      ? this.#api.getVersion(versionId)
      : this.#api.getCurrent(code, query.get('lang') ?? undefined);
  }

  #loadPending() {
    (this.#auth.isLogin() ? this.#api.me() : of<LegalMeDto | null>(null))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (me) => this.#pending.set(me?.pending ?? []),
        error: () => this.#pending.set([]),
      });
  }

  #show(version: LegalVersionDto) {
    this.$version.set(version);
    this.$error.set(null);
    this.#title.setTitle(`${version.title} · Redom`);
  }

  #errorText(error: unknown): string {
    const status = readApiError(error).status;
    if (status === 404) return 'Este documento todavía no está publicado.';
    if (status === 0) return 'No hay conexión con el servidor. Revisa tu internet.';
    return 'No pudimos cargar el documento. Inténtalo de nuevo.';
  }
}
