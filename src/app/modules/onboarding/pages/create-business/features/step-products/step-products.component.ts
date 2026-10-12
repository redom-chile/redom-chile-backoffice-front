import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, concatMap, from, map, of, toArray } from 'rxjs';
import { ButtonComponent, IconComponent, ToastService } from 'src/ui';
import {
  createProductForm,
  suggestSku,
  toCreateProductDto,
} from 'src/app/modules/products/pages/product-list/ui/product-form-fields/product-form';
import { OnboardingApiService } from '../../../../data-access';

const MAX_ROWS = 3;

/** Paso "Tus primeros productos": hasta 3 productos con nombre y precio (IVA incluido). */
@Component({
  selector: 'app-step-products',
  templateUrl: './step-products.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent],
})
export class StepProductsComponent {
  readonly #api = inject(OnboardingApiService);
  readonly #toast = inject(ToastService);
  readonly #fb = inject(FormBuilder);

  // Sin decimales para CLP (y por defecto).
  readonly currencySymbol = input('$');
  readonly integerPrices = input(true);
  readonly completed = output<string[]>();
  readonly busyChange = output<boolean>();

  readonly maxRows = MAX_ROWS;
  readonly rows = this.#fb.nonNullable.array([this.#newRow()]);
  readonly $rowCount = signal(1);
  readonly $isSaving = signal(false);
  readonly $priceStep = computed(() => (this.integerPrices() ? 1 : 0.01));
  // Productos ya creados en este paso (si un reintento falla a medias, no se repiten).
  #created: string[] = [];
  submitted = false;

  addRow() {
    if (this.rows.length >= MAX_ROWS) return;
    this.rows.push(this.#newRow());
    this.$rowCount.set(this.rows.length);
  }

  removeRow(index: number) {
    if (this.rows.length <= 1) return;
    this.rows.removeAt(index);
    this.$rowCount.set(this.rows.length);
  }

  save() {
    this.submitted = true;
    // Filas totalmente vacías se ignoran; si todas lo están, es como omitir.
    const filled = this.rows.controls.filter((row) => row.controls.name.value.trim() || row.controls.price.value !== null);
    if (!filled.length) {
      this.#toast.show('Agrega al menos un producto u omite este paso', 'warning');
      return;
    }
    if (filled.some((row) => row.invalid)) {
      filled.forEach((row) => row.markAllAsTouched());
      this.#toast.show('Revisa el nombre y el precio de cada producto', 'warning');
      return;
    }

    this.#setBusy(true);
    from(filled)
      .pipe(
        concatMap((row) => {
          const { name, price } = row.getRawValue();
          const form = createProductForm(this.#fb);
          form.patchValue({ name: name.trim(), sku: suggestSku(name), price: this.#roundPrice(price ?? 0) });
          return this.#api.createProduct(toCreateProductDto(form, { inventoryEnabled: false })).pipe(
            map(() => ({ row, ok: true })),
            catchError(() => of({ row, ok: false })),
          );
        }),
        toArray(),
      )
      .subscribe((results) => {
        this.#setBusy(false);
        // Quedan en pantalla solo los que fallaron, para reintentar o seguir.
        for (const { row, ok } of results) {
          if (!ok) continue;
          this.#created.push(row.controls.name.value.trim());
          this.rows.removeAt(this.rows.controls.indexOf(row));
        }
        const failed = results.filter((result) => !result.ok).length;
        if (!failed) {
          this.completed.emit([...this.#created]);
          return;
        }
        if (!this.rows.length) this.rows.push(this.#newRow());
        this.$rowCount.set(this.rows.length);
        this.#toast.show(
          failed === results.length
            ? 'No se pudieron crear los productos. Intenta nuevamente u omite este paso.'
            : `Se crearon ${results.length - failed}, pero ${failed === 1 ? '1 falló' : `${failed} fallaron`}. Reintenta u omite.`,
          'error',
        );
      });
  }

  /** Para "Omitir" desde la página: informa lo que alcanzó a crearse. */
  createdSoFar(): string[] {
    return [...this.#created];
  }

  #roundPrice(price: number) {
    return this.integerPrices() ? Math.round(price) : Math.round(price * 100) / 100;
  }

  #newRow() {
    return this.#fb.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      price: [null as number | null, [Validators.required, Validators.min(0)]],
    });
  }

  #setBusy(busy: boolean) {
    this.$isSaving.set(busy);
    this.busyChange.emit(busy);
  }
}
