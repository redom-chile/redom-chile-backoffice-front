import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import { formatDateTimeFull, readId, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  getHelpErrorMessage,
  HELP_MODULE_OPTIONS,
  HELP_SLUG_PATTERN,
  HelpAdminArticleDto,
  HelpAdminService,
  HelpModule,
  SaveHelpArticleDto,
} from '../../data-access';
import { AdminChipInputComponent } from '../../features/admin-chip-input';
import { MarkdownComponent } from '../../ui/markdown';

const BODY_MAX = 20000;
const LIST_MAX = 20;
const ROUTE_MAX = 255;
const TAG_MAX = 40;

/** Largo sin espacios al inicio ni al final, como lo valida el backend tras recortar. */
function trimmedLength(min: number, max: number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const length = (control.value ?? '').trim().length;
    return length < min || length > max ? { length: { min, max, actual: length } } : null;
  };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Nuevo artículo o edición (ruta con :id), con vista previa del markdown. */
@Component({
  selector: 'app-admin-article-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    MarkdownComponent,
    AdminChipInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-article-form.component.html',
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class AdminArticleFormComponent {
  readonly #fb = inject(FormBuilder);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #help = inject(HelpAdminService);

  readonly articleId = readId(this.#route.snapshot.paramMap, 'id');
  readonly isEdit = this.articleId !== null;

  readonly moduleOptions = HELP_MODULE_OPTIONS;
  readonly bodyMax = BODY_MAX;
  readonly listMax = LIST_MAX;
  readonly formatDate = formatDateTimeFull;

  readonly form = this.#fb.group({
    categoryId: this.#fb.control<number | null>(null, Validators.required),
    title: this.#fb.nonNullable.control('', trimmedLength(5, 200)),
    slug: this.#fb.nonNullable.control('', [Validators.minLength(2), Validators.maxLength(220), Validators.pattern(HELP_SLUG_PATTERN)]),
    summary: this.#fb.nonNullable.control('', trimmedLength(10, 300)),
    module: this.#fb.control<HelpModule | null>(null, Validators.required),
    routes: this.#fb.nonNullable.control<string[]>([]),
    tags: this.#fb.nonNullable.control<string[]>([]),
    position: this.#fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
    body: this.#fb.nonNullable.control('', [Validators.required, Validators.maxLength(BODY_MAX)]),
    isPublished: this.#fb.nonNullable.control(false),
  });

  readonly $value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  // ---------- Datos ----------
  readonly detail = rxResource({
    params: () => this.articleId ?? undefined,
    stream: ({ params }) => this.#help.getArticle(params).pipe(toRemoteResult()),
  });
  /** Último estado guardado (se actualiza al guardar). */
  readonly $article = signal<HelpAdminArticleDto | null>(null);
  readonly $detailError = computed(() => resultError(this.detail.value()));

  readonly #categoriesResource = rxResource({ stream: () => this.#help.getCategories(true).pipe(toRemoteResult()) });
  readonly $categories = computed(() => resultValue(this.#categoriesResource.value()) ?? []);
  readonly $categoriesError = computed(() => resultError(this.#categoriesResource.value()));

  // ---------- Estado ----------
  readonly $tab = signal<'write' | 'preview'>('write');
  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly #saved = signal(false);
  readonly #prefilled = signal(!this.isEdit);

  readonly $isLoading = computed(
    () => this.#categoriesResource.isLoading() || (this.isEdit && !this.#prefilled() && !this.$detailError()),
  );
  readonly $loadError = computed(() => this.$detailError() ?? this.$categoriesError());
  readonly $selectedCategoryInactive = computed(() => {
    const id = this.$value().categoryId;
    return !!id && this.$categories().some((category) => category.id === id && !category.isActive);
  });

  readonly normalizeRoute = (value: string): string => {
    const route = value.trim();
    return route.length > 1 ? route.replace(/\/+$/, '') : route;
  };
  readonly validateRoute = (value: string): string | null => {
    if (!value.startsWith('/')) return 'Cada ruta debe empezar con "/" (ej: /cash/sessions)';
    if (/\s/.test(value)) return 'La ruta no puede tener espacios';
    if (value.length > ROUTE_MAX) return `Cada ruta puede tener hasta ${ROUTE_MAX} caracteres`;
    return null;
  };
  readonly normalizeTag = (value: string): string => value.trim().toLowerCase();
  readonly validateTag = (value: string): string | null =>
    value.length > TAG_MAX ? `Cada etiqueta puede tener hasta ${TAG_MAX} caracteres` : null;

  constructor() {
    if (!this.isEdit) {
      const params = this.#route.snapshot.queryParamMap;
      const title = (params.get('title') ?? '').trim().slice(0, 200);
      const categoryId = readId(params, 'categoryId');
      this.form.patchValue({ title, categoryId });
    }

    // Edición: se llena una sola vez al llegar el detalle.
    effect(() => {
      const article = resultValue(this.detail.value());
      if (!article) return;
      untracked(() => this.#prefill(article));
    });
  }

  hasUnsavedChanges(): boolean {
    if (this.#saved() || !this.#prefilled()) return false;
    return this.form.dirty;
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  invalid(name: 'categoryId' | 'title' | 'slug' | 'summary' | 'module' | 'position' | 'body'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.$submitted());
  }

  setList(name: 'routes' | 'tags', values: string[]) {
    const control = this.form.controls[name];
    control.setValue(values);
    control.markAsDirty();
  }

  showError(error: unknown): string {
    return getHelpErrorMessage(error, 'Intenta nuevamente.');
  }

  showWarning(message: string) {
    this.#toast.show(message, 'warning');
  }

  retryLoad() {
    if (this.$categoriesError()) this.#categoriesResource.reload();
    if (this.$detailError()) this.detail.reload();
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (this.form.invalid || !this.form.controls.body.value.trim()) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    const value = this.form.getRawValue();
    const fields = {
      categoryId: value.categoryId!,
      title: value.title.trim(),
      summary: value.summary.trim(),
      body: value.body,
      module: value.module!,
      routes: value.routes,
      tags: value.tags,
      isPublished: value.isPublished,
    };
    const slug = value.slug.trim();
    const position = value.position === null || (value.position as unknown) === '' ? null : Number(value.position);

    const article = this.$article();
    if (article) {
      // Solo lo que cambió; el slug y la posición no se pueden vaciar al editar.
      const dto: SaveHelpArticleDto = {
        ...(fields.categoryId !== article.categoryId ? { categoryId: fields.categoryId } : {}),
        ...(fields.title !== article.title ? { title: fields.title } : {}),
        ...(slug && slug !== article.slug ? { slug } : {}),
        ...(fields.summary !== article.summary ? { summary: fields.summary } : {}),
        ...(fields.body !== article.body ? { body: fields.body } : {}),
        ...(fields.module !== article.module ? { module: fields.module } : {}),
        ...(!sameList(fields.routes, article.routes) ? { routes: fields.routes } : {}),
        ...(!sameList(fields.tags, article.tags) ? { tags: fields.tags } : {}),
        ...(position !== null && position !== article.position ? { position } : {}),
        ...(fields.isPublished !== article.isPublished ? { isPublished: fields.isPublished } : {}),
      };
      if (!Object.keys(dto).length) {
        this.#saved.set(true);
        this.#toast.show('No hay cambios que guardar', 'warning');
        this.#goToList(article.categoryId);
        return;
      }
      this.$isSaving.set(true);
      this.#help
        .updateArticle(article.id, dto)
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe({
          next: (saved) => this.#done(saved, 'Artículo actualizado'),
          error: (error: unknown) => this.#fail(error),
        });
      return;
    }

    const dto: SaveHelpArticleDto = {
      ...fields,
      ...(slug ? { slug } : {}),
      ...(position !== null ? { position } : {}),
    };
    this.$isSaving.set(true);
    this.#help
      .createArticle(dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (saved) => this.#done(saved, saved.isPublished ? 'Artículo creado y publicado' : 'Artículo guardado como borrador'),
        error: (error: unknown) => this.#fail(error),
      });
  }

  #done(saved: HelpAdminArticleDto, message: string) {
    this.#saved.set(true);
    this.$article.set(saved);
    this.#toast.show(message, 'success');
    this.#goToList(saved.categoryId);
  }

  #goToList(categoryId: number) {
    this.#router.navigate(['/help/admin/articles'], { queryParams: { categoryId } });
  }

  // Si falla, el formulario queda intacto.
  #fail(error: unknown) {
    this.$isSaving.set(false);
    this.#toast.show(getHelpErrorMessage(error, 'No se pudo guardar el artículo'), 'error');
  }

  #prefill(article: HelpAdminArticleDto) {
    if (this.#prefilled()) return;
    this.$article.set(article);
    this.form.reset({
      categoryId: article.categoryId,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      module: article.module,
      routes: [...article.routes],
      tags: [...article.tags],
      position: article.position,
      body: article.body,
      isPublished: article.isPublished,
    });
    this.#prefilled.set(true);
  }
}
