import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, Subject } from 'rxjs';
import { readId, readPage, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { getHelpErrorMessage, HelpArticleFiltersDto, HelpService } from '../../data-access';
import { HelpPanelService } from '../../features/help-panel/help-panel.service';

const PER_PAGE = 10;

type HelpHomeQuery = Readonly<{ search: string; categoryId: number | null; page: number }>;

function toQuery(params: ParamMap): HelpHomeQuery {
  return { search: (params.get('search') ?? '').trim(), categoryId: readId(params, 'categoryId'), page: readPage(params) };
}

/** Centro de ayuda: buscador, categorías y artículos (filtros en la URL). */
@Component({
  selector: 'app-help-home',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help-home.component.html',
})
export class HelpHomeComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #help = inject(HelpService);
  readonly #panel = inject(HelpPanelService);
  readonly #destroyRef = inject(DestroyRef);

  readonly skeletonCards = [1, 2, 3, 4, 5, 6];
  readonly skeletonRows = [1, 2, 3, 4];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly $search = signal(this.$query().search);
  readonly #search$ = new Subject<string>();

  readonly $filtering = computed(() => !!(this.$query().search || this.$query().categoryId));

  readonly categories = rxResource({ stream: () => this.#help.getCategories().pipe(toRemoteResult()) });
  readonly $categories = computed(() => (resultValue(this.categories.value()) ?? []).filter((category) => category.articlesCount > 0));
  readonly $categoriesError = computed(() => resultError(this.categories.value()));
  readonly $category = computed(() => {
    const id = this.$query().categoryId;
    return id ? (resultValue(this.categories.value()) ?? []).find((category) => category.id === id) ?? null : null;
  });

  readonly articles = rxResource({
    params: (): HelpArticleFiltersDto | undefined => {
      const { search, categoryId, page } = this.$query();
      return search || categoryId ? { search: search || undefined, categoryId: categoryId ?? undefined, page, perPage: PER_PAGE } : undefined;
    },
    stream: ({ params }) => this.#help.getArticles(params).pipe(toRemoteResult()),
  });
  readonly $page = computed(() => resultValue(this.articles.value()));
  readonly $articlesError = computed(() => resultError(this.articles.value()));
  readonly $errorMessage = computed(() => getHelpErrorMessage(this.$articlesError() ?? this.$categoriesError(), 'Intenta nuevamente.'));

  constructor() {
    this.#search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((search) => this.#navigate({ page: null, search: search.trim() || null }));
  }

  handleSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$search.set(value);
    this.#search$.next(value);
  }

  selectCategory(id: number | null) {
    this.#navigate({ page: null, categoryId: id ? String(id) : null });
  }

  handleClearFilters() {
    this.$search.set('');
    this.#search$.next('');
    this.#navigate({ page: null, search: null, categoryId: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  openAssistant() {
    this.#panel.open('chat');
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
