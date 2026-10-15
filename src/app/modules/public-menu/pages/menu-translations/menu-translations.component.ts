import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, map, Observable, of, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService, isPlanError, PlanUpsellService, PublicPlansService } from 'src/app/core/services/entitlements';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  EXTRA_MENU_LANGUAGES,
  ExtraMenuLanguage,
  MenuSettingsService,
  MenuTranslationItemDto,
  MenuTranslationsPageDto,
  MenuTranslationsService,
  TranslationEntity,
  TranslationFilter,
  TranslationStatus,
} from 'src/app/modules/public-menu/data-access';
import { isFeatureNotIncluded, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { openMenuTranslationAiModal } from 'src/app/modules/public-menu/features/menu-translation-ai-modal';
import { MenuTranslationRowComponent } from 'src/app/modules/public-menu/features/menu-translation-row';
import {
  AiQuota,
  ENTITY_FILTERS,
  isExtraLanguage,
  isTranslationEntity,
  isTranslationFilter,
  LANGUAGE_LABELS,
  STATUS_FILTERS,
  translationErrorMessage,
  translationKey,
} from 'src/app/modules/public-menu/features/menu-translation-shared';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  EmptyStateComponent,
  HeaderDashboardComponent,
  IconComponent,
  PaginationTableComponent,
  ToastService,
} from 'src/ui';

const PAGE_SIZE = 50;
/** Máximo de textos por PUT. */
const SAVE_CHUNK = 500;

type Edit = Readonly<{ item: MenuTranslationItemDto; text: string }>;
type Params = Readonly<{ language: ExtraMenuLanguage | null; status: TranslationFilter; entity: TranslationEntity | null; page: number }>;

const plural = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count} ${many}`);

/**
 * Configuración → Idiomas de la carta: traduce a mano o con IA los textos de la carta.
 * Query params: language (en|pt|de), status (missing|outdated|draft|published|all), entity, page.
 */
@Component({
  selector: 'app-menu-translations',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    IconComponent,
    ButtonComponent,
    EmptyStateComponent,
    PaginationTableComponent,
    CheckPermissionDirective,
    MarketingUpsellCardComponent,
    MenuTranslationRowComponent,
  ],
  templateUrl: './menu-translations.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class MenuTranslationsComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #plans = inject(PublicPlansService);
  readonly #upsell = inject(PlanUpsellService);
  readonly #service = inject(MenuTranslationsService);
  readonly #settingsService = inject(MenuSettingsService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly languages = EXTRA_MENU_LANGUAGES;
  readonly languageLabels = LANGUAGE_LABELS;
  readonly statusFilters = STATUS_FILTERS;
  readonly entityFilters = ENTITY_FILTERS;
  readonly pageSize = PAGE_SIZE;

  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('menu_translations'));
  readonly $hasAi = computed(() => this.#entitlements.hasFeature('menu_ai_translations'));
  readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));
  readonly $aiPlanBadge = computed(() => this.#plans.planName(this.#plans.firstPlanWith(['menu_ai_translations'])?.code) ?? 'Pro');

  readonly #params = toSignal(
    this.#route.queryParamMap.pipe(
      map((params): Params => {
        const language = params.get('language');
        const status = params.get('status');
        const entity = params.get('entity');
        return {
          language: isExtraLanguage(language) ? language : null,
          status: isTranslationFilter(status) ? status : 'all',
          entity: isTranslationEntity(entity) ? entity : null,
          page: Math.max(1, Number(params.get('page')) || 1),
        };
      }),
    ),
    { initialValue: { language: null, status: 'all', entity: null, page: 1 } as Params },
  );
  readonly $status = computed(() => this.#params().status);
  readonly $entity = computed(() => this.#params().entity);
  readonly $page = computed(() => this.#params().page);

  // Idiomas que ofrecen los locales: definen el idioma por defecto.
  readonly settings = rxResource({
    params: () => (this.$hasFeature() ? true : undefined),
    stream: () => this.#settingsService.getSettings().pipe(toRemoteResult()),
  });
  readonly $enabledLanguages = computed(() => {
    const list = resultValue(this.settings.value()) ?? [];
    return EXTRA_MENU_LANGUAGES.filter((language) => list.some((settings) => settings.languages?.includes(language)));
  });
  /** null mientras no se sabe cuál mostrar (sin ?language= hay que esperar los ajustes). */
  readonly $language = computed<ExtraMenuLanguage | null>(() => {
    const fromUrl = this.#params().language;
    if (fromUrl) return fromUrl;
    if (this.settings.isLoading()) return null;
    return this.$enabledLanguages()[0] ?? 'en';
  });
  readonly $languageEnabled = computed(() => {
    const language = this.$language();
    return !language || this.settings.isLoading() || !!this.settings.error() || this.$enabledLanguages().includes(language);
  });

  readonly page = rxResource({
    params: () => {
      const language = this.$language();
      if (!this.$hasFeature() || !language) return undefined;
      return { language, status: this.$status(), entity: this.$entity() ?? undefined, limit: PAGE_SIZE, offset: (this.$page() - 1) * PAGE_SIZE };
    },
    stream: ({ params }) => this.#service.getPage(params).pipe(toRemoteResult()),
  });
  /** Mantiene la página anterior mientras carga la siguiente. */
  readonly $data = linkedSignal<MenuTranslationsPageDto | undefined, MenuTranslationsPageDto | null>({
    source: () => resultValue(this.page.value()) ?? undefined,
    computation: (value, previous) => value ?? (this.page.isLoading() ? (previous?.value ?? null) : null),
  });
  readonly $error = computed(() => resultError(this.page.value()));
  readonly $blocked = computed(() => isFeatureNotIncluded(this.$error()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.$error()));
  readonly $errorMessage = computed(() => translationErrorMessage(this.$error(), 'No se pudieron cargar los textos.'));
  readonly $isFirstLoad = computed(() => !this.$data() && (this.page.isLoading() || !this.$language()));

  readonly $summary = computed(() => {
    const summary = this.$data()?.summary ?? { missing: 0, outdated: 0, draft: 0, published: 0 };
    return { ...summary, all: summary.missing + summary.outdated + summary.draft + summary.published };
  });
  readonly $items = computed(() => this.$data()?.items ?? []);
  readonly $pagination = computed(() => {
    const total = this.$data()?.total ?? 0;
    return { page: this.$page(), perPage: PAGE_SIZE, totalItems: total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });

  // Edición: textos cambiados por clave.
  readonly $edits = signal<ReadonlyMap<string, Edit>>(new Map());
  readonly $editCount = computed(() => this.$edits().size);
  readonly $hasEmptyEdits = computed(() => [...this.$edits().values()].some((edit) => !edit.text.trim()));
  readonly $saving = signal<TranslationStatus | null>(null);
  readonly $publishing = signal(false);
  readonly $deletingId = signal<number | null>(null);
  readonly $quota = signal<AiQuota | null>(null);
  readonly $busy = computed(() => !!this.$saving() || this.$publishing());

  key = translationKey;

  textOf(item: MenuTranslationItemDto): string {
    return this.$edits().get(translationKey(item))?.text ?? item.translation?.text ?? '';
  }

  isDirty(item: MenuTranslationItemDto): boolean {
    return this.$edits().has(translationKey(item));
  }

  onText(item: MenuTranslationItemDto, text: string) {
    const key = translationKey(item);
    this.$edits.update((edits) => {
      const next = new Map(edits);
      // Volver al texto guardado deja la fila sin cambios (salvo si está desactualizada: guardarla la pone al día).
      if (text === (item.translation?.text ?? '') && !item.translation?.outdated) next.delete(key);
      else next.set(key, { item, text });
      return next;
    });
  }

  discardRow(item: MenuTranslationItemDto) {
    this.$edits.update((edits) => {
      const next = new Map(edits);
      next.delete(translationKey(item));
      return next;
    });
  }

  discardAll() {
    this.$edits.set(new Map());
  }

  hasUnsavedChanges(): boolean {
    return this.$editCount() > 0;
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  // ---------- Filtros ----------

  selectLanguage(language: ExtraMenuLanguage) {
    if (language === this.$language()) return;
    this.#navigate({ language, page: null });
  }

  selectStatus(status: TranslationFilter) {
    if (status === this.$status() && this.$page() === 1) return;
    this.#navigate({ status: status === 'all' ? null : status, page: null });
  }

  onEntityChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const entity = isTranslationEntity(value) ? value : null;
    if (entity === this.$entity()) return;
    this.#navigate({ entity, page: null }, () => ((event.target as HTMLSelectElement).value = this.$entity() ?? ''));
  }

  goToPage(page: number) {
    this.#navigate({ page: page > 1 ? page : null });
  }

  /** Cambia los filtros pidiendo confirmación si hay cambios sin guardar. */
  #navigate(queryParams: Record<string, unknown>, onCancel?: () => void) {
    this.#confirmDiscard().subscribe((confirmed) => {
      if (!confirmed) {
        onCancel?.();
        return;
      }
      this.discardAll();
      this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  #confirmDiscard(): Observable<boolean> {
    if (!this.hasUnsavedChanges()) return of(true);
    return this.#confirm({
      title: 'Hay cambios sin guardar',
      message: `Tienes ${plural(this.$editCount(), 'traducción', 'traducciones')} sin guardar. Si sigues, se pierden.`,
      confirmText: 'Descartar cambios',
      cancelText: 'Seguir editando',
      tone: 'danger',
    });
  }

  #confirm(data: ConfirmModalData): Observable<boolean> {
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { width: '440px', maxWidth: '95vw', data })
      .afterClosed()
      .pipe(map((confirmed) => confirmed === true));
  }

  // ---------- Acciones ----------

  save(status: TranslationStatus) {
    const language = this.$language();
    if (!language || this.$busy() || !this.$editCount()) return;
    if (this.$hasEmptyEdits()) {
      this.#toast.show('Hay traducciones vacías: escríbelas o descarta el cambio', 'warning');
      return;
    }
    const items = [...this.$edits().values()].map(({ item, text }) => ({
      entity: item.entity,
      entityId: item.entityId,
      field: item.field,
      text: text.trim(),
      status,
    }));
    const chunks: (typeof items)[] = [];
    for (let i = 0; i < items.length; i += SAVE_CHUNK) chunks.push(items.slice(i, i + SAVE_CHUNK));

    this.$saving.set(status);
    let saved = 0;
    const next = (index: number): Observable<number> =>
      this.#service.save({ language, items: chunks[index] }).pipe(
        switchMap(({ count }) => {
          saved += count;
          return index + 1 < chunks.length ? next(index + 1) : of(saved);
        }),
      );
    next(0).subscribe({
      next: (count) => {
        this.$saving.set(null);
        this.discardAll();
        const text = plural(count, 'traducción', 'traducciones');
        this.#toast.show(status === 'published' ? `Publicamos ${text}` : `Guardamos ${text} como borrador`, 'success');
        this.page.reload();
      },
      error: (error: unknown) => {
        this.$saving.set(null);
        // Si alcanzó a guardar una parte, se recarga (lo editado se mantiene para reintentar).
        if (saved) this.page.reload();
        if (!isPlanError(error)) this.#toast.show(translationErrorMessage(error, 'No se pudieron guardar las traducciones.'), 'error');
      },
    });
  }

  publishAll() {
    const language = this.$language();
    const drafts = this.$summary().draft;
    if (!language || this.$busy() || !drafts) return;
    const unsaved = this.hasUnsavedChanges() ? ' Los cambios sin guardar no se incluyen.' : '';
    this.#confirm({
      title: 'Publicar todo',
      message: `Se publican ${plural(drafts, 'borrador', 'borradores')} en ${LANGUAGE_LABELS[language].name.toLowerCase()} y tus clientes los verán en la carta.${unsaved}`,
      confirmText: 'Publicar',
      cancelText: 'Volver',
      tone: 'primary',
    })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.$publishing.set(true);
          return this.#service.publish(language);
        }),
      )
      .subscribe({
        next: ({ count }) => {
          this.$publishing.set(false);
          this.#toast.show(`Publicamos ${plural(count, 'traducción', 'traducciones')}`, 'success');
          this.page.reload();
        },
        error: (error: unknown) => {
          this.$publishing.set(false);
          if (!isPlanError(error)) this.#toast.show(translationErrorMessage(error, 'No se pudieron publicar los borradores.'), 'error');
        },
      });
  }

  remove(item: MenuTranslationItemDto) {
    const translation = item.translation;
    if (!translation || this.$deletingId()) return;
    this.#confirm({
      title: 'Borrar traducción',
      message: `¿Borrar la traducción "${translation.text}"? En la carta se verá el texto en español.`,
      confirmText: 'Borrar',
      cancelText: 'Volver',
      tone: 'danger',
    })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.$deletingId.set(translation.id);
          return this.#service.delete(translation.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$deletingId.set(null);
          this.discardRow(item);
          this.#toast.show('Traducción borrada', 'success');
          this.page.reload();
        },
        error: (error: unknown) => {
          this.$deletingId.set(null);
          if (!isPlanError(error)) this.#toast.show(translationErrorMessage(error, 'No se pudo borrar la traducción.'), 'error');
        },
      });
  }

  translateWithAi() {
    const language = this.$language();
    if (!language || this.$busy()) return;
    if (!this.$hasAi()) {
      this.#upsell.open({ features: ['menu_ai_translations'] });
      return;
    }
    const { missing, outdated } = this.$summary();
    if (!missing && !outdated) {
      this.#toast.show('No hay textos sin traducir ni desactualizados', 'warning');
      return;
    }
    this.#confirmDiscard()
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.discardAll();
          return openMenuTranslationAiModal(this.#dialog, { language, missing, outdated, quota: this.$quota() });
        }),
      )
      .subscribe((result) => {
        if (!result) return;
        if (result.quota) this.$quota.set(result.quota);
        if (!result.translated) return;
        this.#toast.show(`Tradujimos ${plural(result.translated, 'texto', 'textos')}: revísalos en Borradores`, 'success');
        if (this.$status() === 'draft' && this.$page() === 1 && !this.$entity()) this.page.reload();
        else this.#router.navigate([], { relativeTo: this.#route, queryParams: { status: 'draft', page: null, entity: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
  }

  retry() {
    this.page.reload();
  }
}
