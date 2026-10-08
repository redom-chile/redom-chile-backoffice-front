import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map, Subject } from 'rxjs';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { currentHelpRoute, getHelpErrorMessage, HelpService } from '../../data-access';
import { MarkdownComponent } from '../../ui';
import { ArticleFeedbackComponent } from '../article-feedback/article-feedback.component';
import { HelpChatComponent } from '../help-chat/help-chat.component';
import { HelpPanelService, HelpPanelTab } from './help-panel.service';

const PER_PAGE = 5;

/** Panel lateral: artículos de la pantalla actual y chat con el asistente. Va una sola vez en el layout. */
@Component({
  selector: 'app-help-panel',
  imports: [RouterLink, IconComponent, SkeletonComponent, MarkdownComponent, ArticleFeedbackComponent, HelpChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'handleEscape()' },
  templateUrl: './help-panel.component.html',
  styles: `
    .help-panel {
      animation: help-panel-in 0.2s ease-out;
    }
    @keyframes help-panel-in {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .help-panel {
        animation: none;
      }
    }
  `,
})
export class HelpPanelComponent {
  readonly #router = inject(Router);
  readonly #help = inject(HelpService);
  readonly #injector = inject(Injector);
  readonly #destroyRef = inject(DestroyRef);
  protected readonly panel = inject(HelpPanelService);

  readonly skeletonRows = [1, 2, 3];

  readonly $route = toSignal(
    this.#router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => currentHelpRoute(this.#router.url)),
    ),
    { initialValue: currentHelpRoute(this.#router.url) },
  );

  readonly $search = signal('');
  readonly $searchQuery = signal('');
  readonly #search$ = new Subject<string>();

  // Artículo abierto dentro del panel; se cierra al cambiar de pantalla.
  readonly $articleSlug = linkedSignal<string, string | null>({ source: this.$route, computation: () => null });

  readonly articles = rxResource({
    params: () =>
      this.panel.$open() && this.panel.$tab() === 'articles' && !this.$articleSlug()
        ? { route: this.$route(), search: this.$searchQuery() || undefined, perPage: PER_PAGE }
        : undefined,
    stream: ({ params }) => this.#help.getArticles(params).pipe(toRemoteResult()),
  });
  readonly $articles = computed(() => resultValue(this.articles.value())?.data ?? []);
  readonly $articlesError = computed(() => resultError(this.articles.value()));

  readonly article = rxResource({
    params: () => (this.panel.$open() ? (this.$articleSlug() ?? undefined) : undefined),
    stream: ({ params }) => this.#help.getArticle(params).pipe(toRemoteResult()),
  });
  readonly $article = computed(() => resultValue(this.article.value()));
  readonly $articleError = computed(() => {
    const error = resultError(this.article.value());
    return error ? getHelpErrorMessage(error, 'No se pudo cargar el artículo.') : null;
  });

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  #previousFocus: HTMLElement | null = null;

  constructor() {
    this.#search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((search) => this.$searchQuery.set(search.trim()));

    // En el centro de ayuda el panel sobra: se cierra al entrar.
    this.#router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe(() => {
        const route = currentHelpRoute(this.#router.url);
        if (route === '/help' || route.startsWith('/help/')) this.panel.close();
      });

    // Foco al abrir y de vuelta al botón que lo abrió al cerrar.
    effect(() => {
      const open = this.panel.$open();
      untracked(() => {
        if (open) {
          this.#previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          afterNextRender(() => this.dialog()?.nativeElement.focus(), { injector: this.#injector });
        } else if (this.#previousFocus) {
          this.#previousFocus.focus();
          this.#previousFocus = null;
        }
      });
    });
  }

  handleEscape() {
    if (this.panel.$open()) this.panel.close();
  }

  setTab(tab: HelpPanelTab) {
    this.panel.setTab(tab);
  }

  handleSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$search.set(value);
    this.#search$.next(value);
  }

  /** Desde el chat (sin preguntas disponibles): busca la pregunta en los artículos. */
  handleSearchRequested(question: string) {
    const search = question.trim().slice(0, 200);
    this.$search.set(search);
    this.$searchQuery.set(search);
    this.#search$.next(search);
    this.$articleSlug.set(null);
    this.panel.setTab('articles');
  }

  openArticle(slug: string) {
    this.$articleSlug.set(slug);
  }

  closeArticle() {
    this.$articleSlug.set(null);
  }
}
