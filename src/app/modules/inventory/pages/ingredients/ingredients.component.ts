import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { combineLatest, debounceTime, distinctUntilChanged, EMPTY, filter, map, Subject, switchMap, catchError, tap, startWith } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { getInventoryErrorMessage, isInventoryDisabledError, UnitsService } from '../../data-access';
import { InventoryDisabledComponent } from '../../ui';
import { IngredientDto, IngredientsService } from './data-access';
import { IngredientModalComponent, IngredientModalData, IngredientModalResult } from './features';
import { IngredientsTableComponent } from './ui';

const PER_PAGE = 10;

type IngredientsQuery = Readonly<{ page: number; q: string }>;

function toQuery(params: ParamMap): IngredientsQuery {
  const page = Number(params.get('page'));
  return { page: Number.isInteger(page) && page > 0 ? page : 1, q: params.get('q') ?? '' };
}

@Component({
  selector: 'app-ingredients',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    IngredientsTableComponent,
  ],
  templateUrl: './ingredients.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngredientsComponent implements OnInit {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #ingredients = inject(IngredientsService);
  readonly #units = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);

  readonly $settingsLoaded = this.#settings.$isLoaded;
  readonly $settingsError = this.#settings.$hasError;
  readonly $inventoryEnabled = this.#settings.$inventoryEnabled;
  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly search = new FormControl(this.$query().q, { nonNullable: true });

  readonly #response = signal<StandardizedPagination<IngredientDto> | null>(null);
  readonly $isLoading = signal(false);
  readonly $errorMessage = signal<string | null>(null);
  // El backend respondió 409 "Inventory is not enabled" (la configuración local estaba desactualizada).
  readonly $disabledByServer = signal(false);
  readonly #reload$ = new Subject<void>();
  // Solo se piden ingredientes con inventario + ingredientes activos.
  readonly #enabled$ = toObservable(this.$ingredientsEnabled);

  readonly $ingredients = computed(() => this.#response()?.data ?? []);
  readonly $pagination = computed(() => this.#response()?.pagination ?? null);
  readonly $units = computed(() => this.#units.$units() ?? []);
  readonly $isEmpty = computed(
    () => !this.$isLoading() && !this.$errorMessage() && !this.$query().q && this.$pagination()?.totalItems === 0,
  );

  ngOnInit(): void {
    combineLatest([this.#route.queryParamMap.pipe(map(toQuery)), this.#enabled$, this.#reload$.pipe(startWith(undefined))])
      .pipe(
        filter(([, enabled]) => enabled),
        tap(() => {
          this.$isLoading.set(true);
          this.$errorMessage.set(null);
          this.#units.load();
        }),
        switchMap(([{ page, q }]) =>
          this.#ingredients.list({ page, perPage: PER_PAGE, name: q || undefined }).pipe(
            catchError((error) => {
              this.$isLoading.set(false);
              if (isInventoryDisabledError(error)) {
                this.$disabledByServer.set(true);
                this.#settings.reload();
              } else {
                this.$errorMessage.set(getInventoryErrorMessage(error, 'No se pudieron cargar los ingredientes.'));
              }
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((response) => {
        this.#response.set(response);
        this.$isLoading.set(false);
        this.$disabledByServer.set(false);
      });

    this.search.valueChanges
      .pipe(debounceTime(350), map((value) => value.trim()), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((q) => this.#navigate({ q: q || null, page: null }));
  }

  retrySettings() {
    this.#settings.reload();
  }

  handleRetry() {
    this.#reload$.next();
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  handleCreate() {
    this.#openModal({});
  }

  handleEdit(ingredient: IngredientDto) {
    this.#openModal({ ingredient });
  }

  #openModal(data: IngredientModalData) {
    this.#dialog
      .open<IngredientModalComponent, IngredientModalData, IngredientModalResult>(IngredientModalComponent, {
        width: '640px',
        maxWidth: '95vw',
        disableClose: true,
        data,
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.#toast.show(result === 'created' ? 'Ingrediente creado' : 'Ingrediente actualizado', 'success');
        this.#reload$.next();
      });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
