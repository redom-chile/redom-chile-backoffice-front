import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, Subject } from 'rxjs';
import {
  readDate,
  readId,
  readOption,
  readPage,
  resultError,
  resultValue,
  toRemoteResult,
} from 'src/app/modules/inventory/shared/data-access';
import { HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { getHelpErrorMessage, HelpAdminService, HelpChatLogDto, HelpChatLogFiltersDto } from '../../data-access';
import { formatHelpDateTime, formatInteger, formatUsd } from '../../features/usage-format';
import { MarkdownComponent } from '../../ui';

const PER_PAGE = 20;
/** Largo máximo del título de un artículo en el backend. */
const ARTICLE_TITLE_MAX = 200;

type HelpfulFilter = 'true' | 'false';
type ReviewPreset = 'all' | 'improve' | 'withoutArticles';

type ReviewQuery = Readonly<{
  page: number;
  helpful: HelpfulFilter | null;
  withoutArticles: boolean;
  from: string | null;
  to: string | null;
  businessId: number | null;
}>;

function toQuery(params: ParamMap): ReviewQuery {
  return {
    page: readPage(params),
    helpful: readOption<HelpfulFilter>(params, 'helpful', ['true', 'false']),
    withoutArticles: params.get('withoutArticles') === 'true',
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
    businessId: readId(params, 'businessId'),
  };
}

const STATUS: Record<string, Readonly<{ label: string; classes: string }>> = {
  HELP_AI_UNAVAILABLE: { label: 'Falló la IA', classes: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  CLIENT_ABORTED: { label: 'Cancelada por el usuario', classes: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
};
const ANSWERED = { label: 'Respondida', classes: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };

/** Preguntas al asistente (SUPERADMIN): para encontrar lo que falta en los artículos de ayuda. */
@Component({
  selector: 'app-admin-review',
  imports: [RouterLink, HeaderDashboardComponent, IconComponent, SkeletonComponent, PaginationTableComponent, MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-review.component.html',
})
export class AdminReviewComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #admin = inject(HelpAdminService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatDateTime = formatHelpDateTime;
  readonly formatUsd = formatUsd;
  readonly formatInteger = formatInteger;
  readonly skeletonRows = [1, 2, 3, 4];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });

  readonly $invalidRange = computed(() => {
    const { from, to } = this.$query();
    return !!from && !!to && from > to;
  });

  readonly $preset = computed<ReviewPreset | null>(() => {
    const { helpful, withoutArticles } = this.$query();
    if (!helpful && !withoutArticles) return 'all';
    if (helpful === 'false' && !withoutArticles) return 'improve';
    if (!helpful && withoutArticles) return 'withoutArticles';
    return null;
  });

  readonly $businessInput = signal(this.$query().businessId?.toString() ?? '');
  readonly #business$ = new Subject<string>();

  readonly logs = rxResource({
    params: (): HelpChatLogFiltersDto | undefined => {
      if (this.$invalidRange()) return undefined;
      const { page, helpful, withoutArticles, from, to, businessId } = this.$query();
      return {
        page,
        perPage: PER_PAGE,
        helpful: helpful ? helpful === 'true' : undefined,
        withoutArticles: withoutArticles || undefined,
        from: from ?? undefined,
        to: to ?? undefined,
        businessId: businessId ?? undefined,
      };
    },
    stream: ({ params }) => this.#admin.getChatLogs(params).pipe(toRemoteResult()),
  });
  readonly $page = computed(() => resultValue(this.logs.value()));
  readonly $error = computed(() => resultError(this.logs.value()));
  readonly $errorMessage = computed(() => getHelpErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly $hasFilters = computed(() => {
    const { helpful, withoutArticles, from, to, businessId } = this.$query();
    return !!(helpful || withoutArticles || from || to || businessId);
  });

  readonly $expanded = signal<ReadonlySet<number>>(new Set());

  constructor() {
    this.#business$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((value) => {
        const id = Number(value);
        this.#navigate({ page: null, businessId: Number.isInteger(id) && id > 0 ? String(id) : null });
      });
  }

  status(log: HelpChatLogDto) {
    if (!log.errorCode) return ANSWERED;
    return STATUS[log.errorCode] ?? { label: log.errorCode, classes: 'bg-slate-500/15 text-muted-foreground' };
  }

  isExpanded(id: number): boolean {
    return this.$expanded().has(id);
  }

  toggle(id: number) {
    this.$expanded.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  handlePreset(preset: ReviewPreset) {
    this.#navigate({
      page: null,
      helpful: preset === 'improve' ? 'false' : null,
      withoutArticles: preset === 'withoutArticles' ? 'true' : null,
    });
  }

  handleHelpful(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.#navigate({ page: null, helpful: value || null });
  }

  handleWithoutArticles(event: Event) {
    this.#navigate({ page: null, withoutArticles: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  handleDate(key: 'from' | 'to', event: Event) {
    this.#navigate({ page: null, [key]: (event.target as HTMLInputElement).value || null });
  }

  handleBusinessInput(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    this.$businessInput.set(value);
    this.#business$.next(value);
  }

  filterByBusiness(businessId: number) {
    this.$businessInput.set(String(businessId));
    this.#business$.next(String(businessId));
  }

  handleClearFilters() {
    this.$businessInput.set('');
    this.#business$.next('');
    this.#navigate({ page: null, helpful: null, withoutArticles: null, from: null, to: null, businessId: null });
  }

  handlePageChange(page: number) {
    this.$expanded.set(new Set());
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  /** Abre el editor con la pregunta como título del artículo nuevo. */
  createArticle(log: HelpChatLogDto) {
    const title = log.question.trim().replace(/\s+/g, ' ').slice(0, ARTICLE_TITLE_MAX);
    this.#router.navigate(['/help/admin/articles/new'], { queryParams: { title } });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
