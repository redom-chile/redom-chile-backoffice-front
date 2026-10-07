import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { ButtonComponent, IconComponent, ModalCardComponent, SkeletonComponent, SlotDirective, ToastService } from 'src/ui';
import {
  getModifierSetErrorMessage,
  LinkableProductsService,
  LinkedProductDto,
  ModifierSetDto,
  ModifierSetsService,
} from '../../data-access';
import { ModifierSetModalResult } from '../modifier-set-modal-result';

type SearchState = Readonly<{ status: 'loading' | 'ready' | 'error'; products: LinkedProductDto[]; hasMore: boolean }>;

@Component({
  selector: 'app-modifier-set-products-modal',
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SkeletonComponent, SlotDirective],
  templateUrl: './modifier-set-products-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModifierSetProductsModalComponent implements OnInit {
  readonly #dialogRef = inject<MatDialogRef<ModifierSetProductsModalComponent, ModifierSetModalResult>>(MatDialogRef);
  readonly #toast = inject(ToastService);
  readonly #service = inject(ModifierSetsService);
  readonly #products = inject(LinkableProductsService);
  readonly #destroyRef = inject(DestroyRef);

  readonly set = inject<ModifierSetDto>(MAT_DIALOG_DATA);

  readonly #search$ = new Subject<string>();
  readonly #retry$ = new Subject<void>();

  readonly $isLoadingLinked = signal(true);
  readonly $isSaving = signal(false);
  readonly $query = signal('');
  readonly $search = signal<SearchState>({ status: 'loading', products: [], hasMore: false });
  // Se parte con lo que trae la lista; se reemplaza con GET /product-modifiers/:id.
  readonly $selected = signal<LinkedProductDto[]>([...this.set.modifierProducts]);
  readonly $selectedIds = computed(() => new Set(this.$selected().map((product) => product.id)));

  ngOnInit(): void {
    this.#service
      .findLinkedProducts(this.set.id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (response) => {
          this.$selected.set([...response.products]);
          this.$isLoadingLinked.set(false);
        },
        // Si falla, queda la selección que venía en la lista.
        error: () => this.$isLoadingLinked.set(false),
      });

    this.#search$
      .pipe(
        debounceTime(300),
        map((query) => query.trim()),
        startWith(''),
        distinctUntilChanged(),
        // Reintentar repite la última búsqueda.
        switchMap((query) => this.#retry$.pipe(startWith(undefined), map(() => query))),
        tap(() => this.$search.update((state) => ({ ...state, status: 'loading' }))),
        switchMap((query) =>
          this.#products.search(query).pipe(
            map((result): SearchState => ({ status: 'ready', ...result })),
            catchError(() => of<SearchState>({ status: 'error', products: [], hasMore: false })),
          ),
        ),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((state) => this.$search.set(state));
  }

  handleSearch(value: string) {
    this.$query.set(value);
    this.#search$.next(value);
  }

  retrySearch() {
    this.#retry$.next();
  }

  toggle(product: LinkedProductDto) {
    if (this.$selectedIds().has(product.id)) {
      this.remove(product);
    } else {
      this.$selected.update((selected) => [...selected, product]);
    }
  }

  remove(product: LinkedProductDto) {
    this.$selected.update((selected) => selected.filter((item) => item.id !== product.id));
  }

  handleSave() {
    this.$isSaving.set(true);
    this.#service
      .updateLinkedProducts({ id: this.set.id, products: this.$selected().map((product) => product.id) })
      .subscribe({
        next: () => this.#dialogRef.close('linked'),
        error: (error) => {
          this.$isSaving.set(false);
          this.#toast.show(getModifierSetErrorMessage(error, 'No se pudieron guardar los productos.'), 'error');
        },
      });
  }

  handleCancel() {
    this.#dialogRef.close();
  }
}
