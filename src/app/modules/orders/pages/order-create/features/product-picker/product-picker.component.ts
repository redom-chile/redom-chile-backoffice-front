import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { IconComponent, ProgressBarComponent } from 'src/ui';
import { CategoryDto } from 'src/app/modules/products/pages/categories/data-access';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { formatCurrency } from '../../../order-list/ui';
import { hasModifierSets, productPrice } from '../cart-line';

@Component({
  selector: 'app-product-picker',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent, ProgressBarComponent],
  templateUrl: './product-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPickerComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly products = input.required<ProductDto[]>();
  readonly categories = input<CategoryDto[]>([]);
  readonly loading = input(false);
  readonly selectedCategoryId = input<number | null>(null);
  readonly quantities = input<Record<number, number>>({});

  readonly categoryChange = output<number | null>();
  readonly searchChange = output<string>();
  readonly add = output<ProductDto>();

  readonly search = new FormControl('', { nonNullable: true });

  // Categoría padre activa: la elegida o la que contiene la subcategoría elegida.
  readonly $selectedParent = computed(() => {
    const id = this.selectedCategoryId();
    if (id === null) return null;
    return this.categories().find((c) => c.id === id || c.subcategories?.some((sub) => sub.id === id)) ?? null;
  });
  // URLs firmadas que vencieron o fallaron: se muestra la inicial.
  readonly brokenImages = signal<ReadonlySet<number>>(new Set());
  readonly formatCurrency = formatCurrency;

  ngOnInit(): void {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchChange.emit(value));
  }

  price(product: ProductDto): number {
    return productPrice(product);
  }

  hasOptions(product: ProductDto): boolean {
    return hasModifierSets(product);
  }

  initial(name: string): string {
    return name.trim().charAt(0) || '?';
  }

  markBroken(productId: number) {
    this.brokenImages.update((ids) => new Set(ids).add(productId));
  }
}
