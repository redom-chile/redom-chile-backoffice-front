import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, Subject } from 'rxjs';
import {
  formatDateTimeFull,
  readId,
  readOption,
  readPage,
  resultError,
  resultValue,
  toRemoteResult,
} from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  getHelpErrorMessage,
  HELP_MODULE_LABELS,
  HELP_MODULE_OPTIONS,
  HELP_MODULES,
  HelpAdminArticleFiltersDto,
  HelpAdminArticleItemDto,
  HelpAdminService,
  HelpArticleStatus,
  HelpModule,
} from '../../data-access';
import { openAdminArticleFeedbackModal } from '../../features/admin-article-feedback-modal';
import { confirmHelpAction } from '../../features/admin-confirm';

const PER_PAGE = 20;
/** Máximo que entrega el backend por página: al ordenar se carga la categoría completa. */
const REORDER_LIMIT = 100;
const STATUSES: HelpArticleStatus[] = ['published', 'draft'];

type AdminArticlesQuery = Readonly<{
  page: number;
  search: string;
  status: HelpArticleStatus | null;
  categoryId: number | null;
  module: HelpModule | null;
}>;

function toQuery(params: ParamMap): AdminArticlesQuery {
  return {
    page: readPage(params),
    search: (params.get('search') ?? '').trim(),
    status: readOption<HelpArticleStatus>(params, 'status', STATUSES),
    categoryId: readId(params, 'categoryId'),
    module: readOption<HelpModule>(params, 'module', HELP_MODULES),
  };
}

/** Artículos del centro de ayuda (borradores incluidos), con filtros en la URL y orden por categoría. */
@Component({
  selector: 'app-admin-articles',
  imports: [
    RouterLink,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    PaginationTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-articles.component.html',
  styles: `
    .cdk-drag-preview {
      background: var(--card);
      border-radius: 0.75rem;
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    }
    .cdk-drag-placeholder {
      opacity: 0.35;
    }
    .cdk-drag-animating,
    .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
  `,
})
export class AdminArticlesComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #help = inject(HelpAdminService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly moduleOptions = HELP_MODULE_OPTIONS;
  readonly moduleLabels = HELP_MODULE_LABELS;
  readonly formatDate = formatDateTimeFull;
  readonly reorderLimit = REORDER_LIMIT;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly $search = signal(this.$query().search);
  readonly #search$ = new Subject<string>();

  /** Solo se ordena viendo una categoría completa, sin otros filtros. */
  readonly $canReorder = computed(() => {
    const { categoryId, search, status, module } = this.$query();
    return !!categoryId && !search && !status && !module;
  });

  readonly articles = rxResource({
    params: (): HelpAdminArticleFiltersDto => {
      const { page, search, status, categoryId, module } = this.$query();
      if (this.$canReorder()) return { categoryId: categoryId!, page: 1, perPage: REORDER_LIMIT };
      return {
        page,
        perPage: PER_PAGE,
        search: search || undefined,
        status: status ?? undefined,
        categoryId: categoryId ?? undefined,
        module: module ?? undefined,
      };
    },
    stream: ({ params }) => this.#help.getArticles(params).pipe(toRemoteResult()),
  });
  readonly $page = computed(() => resultValue(this.articles.value()));
  readonly $error = computed(() => resultError(this.articles.value()));
  // Copia local: se actualiza al publicar y al reordenar sin recargar.
  readonly $items = linkedSignal<HelpAdminArticleItemDto[]>(() => this.$page()?.data ?? []);

  readonly $tooManyToReorder = computed(() => (this.$page()?.pagination.totalItems ?? 0) > REORDER_LIMIT);
  readonly $dragEnabled = computed(() => this.$canReorder() && !this.$tooManyToReorder() && this.$items().length > 1);
  readonly $isReordering = signal(false);
  readonly $busyId = signal<number | null>(null);

  readonly #categories = rxResource({ stream: () => this.#help.getCategories(true).pipe(toRemoteResult()) });
  readonly $categories = computed(() => resultValue(this.#categories.value()) ?? []);

  readonly $hasFilters = computed(() => {
    const { search, status, categoryId, module } = this.$query();
    return !!(search || status || categoryId || module);
  });

  constructor() {
    this.#search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((search) => this.#navigate({ page: null, search: search.trim() || null }));
  }

  errorMessage(error: unknown): string {
    return getHelpErrorMessage(error, 'Intenta nuevamente.');
  }

  handleSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$search.set(value);
    this.#search$.next(value);
  }

  handleSelect(key: 'categoryId' | 'module' | 'status', event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.#navigate({ page: null, [key]: value || null });
  }

  handleClearFilters() {
    this.$search.set('');
    this.#search$.next('');
    this.#navigate({ page: null, search: null, status: null, categoryId: null, module: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  handleDrop(event: CdkDragDrop<HelpAdminArticleItemDto[]>) {
    const categoryId = this.$query().categoryId;
    if (!categoryId || event.previousIndex === event.currentIndex) return;
    const previous = this.$items();
    const next = [...previous];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.$items.set(next);
    this.$isReordering.set(true);
    this.#help
      .reorderArticles(categoryId, next.map((article) => article.id))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.$isReordering.set(false);
          this.#toast.show('Orden guardado', 'success');
        },
        error: (error: unknown) => {
          this.$isReordering.set(false);
          this.$items.set(previous);
          this.#toast.show(getHelpErrorMessage(error, 'No se pudo guardar el orden'), 'error');
        },
      });
  }

  handleTogglePublish(article: HelpAdminArticleItemDto) {
    if (this.$busyId()) return;
    const isPublished = !article.isPublished;
    this.$busyId.set(article.id);
    this.#help
      .publishArticle(article.id, isPublished)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (saved) => {
          this.$busyId.set(null);
          this.#toast.show(isPublished ? 'Artículo publicado' : 'Artículo pasado a borrador', 'success');
          // Con filtro de estado el artículo deja de corresponder: se recarga la página.
          if (this.$query().status) {
            this.articles.reload();
            return;
          }
          this.$items.update((items) =>
            items.map((item) =>
              item.id === saved.id
                ? { ...item, isPublished: saved.isPublished, publishedAt: saved.publishedAt, updatedAt: saved.updatedAt, updatedByName: saved.updatedByName }
                : item,
            ),
          );
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          this.#toast.show(getHelpErrorMessage(error, 'No se pudo cambiar el estado del artículo'), 'error');
        },
      });
  }

  handleDuplicate(article: HelpAdminArticleItemDto) {
    if (this.$busyId()) return;
    this.$busyId.set(article.id);
    this.#help
      .duplicateArticle(article.id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (copy) => {
          this.$busyId.set(null);
          this.#toast.show('Artículo duplicado como borrador', 'success');
          this.#router.navigate(['/help/admin/articles', copy.id, 'edit']);
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          this.#toast.show(getHelpErrorMessage(error, 'No se pudo duplicar el artículo'), 'error');
        },
      });
  }

  handleVotes(article: HelpAdminArticleItemDto) {
    openAdminArticleFeedbackModal(this.#dialog, { article });
  }

  handleDelete(article: HelpAdminArticleItemDto) {
    confirmHelpAction(this.#dialog, {
      title: 'Eliminar artículo',
      message: `¿Eliminar "${article.title}"? También se borran sus votos. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Volver',
      tone: 'danger',
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.$busyId.set(article.id);
      this.#help
        .deleteArticle(article.id)
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe({
          next: () => {
            this.$busyId.set(null);
            this.#toast.show('Artículo eliminado', 'success');
            const { page } = this.$query();
            // Si era el último de la página, vuelve a la anterior.
            if (!this.$canReorder() && page > 1 && this.$items().length === 1) {
              this.handlePageChange(page - 1);
            } else {
              this.articles.reload();
            }
          },
          error: (error: unknown) => {
            this.$busyId.set(null);
            this.#toast.show(getHelpErrorMessage(error, 'No se pudo eliminar el artículo'), 'error');
          },
        });
    });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
