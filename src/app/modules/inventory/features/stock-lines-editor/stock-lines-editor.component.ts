import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap, tap } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ClickOutsideDirective, IconComponent, ToastService } from 'src/ui';
import {
  formatMoney,
  formatQuantity,
  StockableItem,
  StockableItemsService,
  todayIsoDate,
  UnitDto,
  unitMultiplier,
  UnitsService,
  unitsForProduct,
} from '../../data-access';
import {
  lotApplies,
  MAX_LOT_NUMBER_LENGTH,
  MAX_STOCK_LINES,
  StockLineCostMode,
  StockLineForm,
  StockLineHintFn,
  StockLineLotMode,
  StockLineQuantityMode,
  StockLinesArray,
} from './stock-line-form';

const KIND_LABELS: Record<StockableItem['kind'], string> = { ingredient: 'Ingrediente', product: 'Producto' };

// Grilla de escritorio: ítem · cantidad · unidad · [costo · subtotal] · quitar.
const GRID_WITH_COST = 'sm:grid-cols-[minmax(0,1fr)_8rem_9rem_8.5rem_7rem_2.5rem]';
const GRID_WITHOUT_COST = 'sm:grid-cols-[minmax(0,1fr)_8rem_9rem_2.5rem]';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function decimalsOf(value: number): number {
  const [, decimals = ''] = String(value).split('.');
  return decimals.length;
}

/**
 * Editor de líneas de stock (compras y ajustes): buscador de ítems con stock propio y, por línea,
 * cantidad, unidad, costo unitario y subtotal. Trabaja sobre un FormArray del formulario padre.
 */
@Component({
  selector: 'app-stock-lines-editor',
  imports: [ReactiveFormsModule, IconComponent, ClickOutsideDirective],
  templateUrl: './stock-lines-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockLinesEditorComponent {
  readonly #itemsService = inject(StockableItemsService);
  readonly #unitsService = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);
  readonly #cdr = inject(ChangeDetectorRef);
  readonly #destroyRef = inject(DestroyRef);

  readonly lines = input.required<StockLinesArray>();
  readonly costMode = input<StockLineCostMode>('required');
  readonly quantityMode = input<StockLineQuantityMode>('positive');
  /** Muestra los errores de todas las líneas (después de intentar guardar). */
  readonly showErrors = input(false);
  /** Precarga una línea con esta variación (ej. ?variationId= desde el stock). */
  readonly preselectVariationId = input<number | null>(null);
  /** Texto opcional bajo cada ítem (ej. stock disponible en el origen de una transferencia). */
  readonly lineHint = input<StockLineHintFn | null>(null);
  /** Lote y vencimiento por línea (compras, stock inicial, correcciones que suman). */
  readonly lotMode = input<StockLineLotMode>('none');

  protected readonly kindLabels = KIND_LABELS;
  protected readonly formatMoney = formatMoney;
  protected readonly maxLotLength = MAX_LOT_NUMBER_LENGTH;

  // Líneas con el bloque de lote abierto (también se abre solo si ya tiene datos).
  protected readonly $lotOpen = signal<ReadonlySet<StockLineForm>>(new Set());

  protected readonly $units = computed(() => this.#unitsService.$units() ?? []);
  protected readonly $showCost = computed(() => this.costMode() !== 'none');
  protected readonly $gridClass = computed(() => (this.$showCost() ? GRID_WITH_COST : GRID_WITHOUT_COST));

  // Buscador
  readonly #term$ = new Subject<string>();
  protected readonly $term = signal('');
  protected readonly $results = signal<StockableItem[]>([]);
  protected readonly $isSearching = signal(false);
  protected readonly $searchFailed = signal(false);
  protected readonly $isOpen = signal(false);
  protected readonly $activeIndex = signal(0);
  #preselectDone = false;

  constructor() {
    this.#unitsService.load();

    this.#term$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => {
          this.$isSearching.set(true);
          this.$searchFailed.set(false);
        }),
        switchMap((term) =>
          this.#itemsService.search(term, { includeIngredients: this.#settings.$ingredientsEnabled() }).pipe(
            catchError(() => {
              this.$searchFailed.set(true);
              return of<StockableItem[]>([]);
            }),
          ),
        ),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((items) => {
        this.$results.set(items);
        this.$activeIndex.set(0);
        this.$isSearching.set(false);
      });

    // Al cambiar el modo (motivo del ajuste) o llegar las unidades, se revalidan las líneas.
    effect(() => {
      this.quantityMode();
      this.costMode();
      this.lotMode();
      this.$units();
      untracked(() => {
        this.lines().controls.forEach((line) => line.updateValueAndValidity());
        this.lines().updateValueAndValidity();
        this.#cdr.markForCheck();
      });
    });

    effect(() => {
      const variationId = this.preselectVariationId();
      if (!variationId || this.#preselectDone) return;
      this.#preselectDone = true;
      untracked(() => this.#preselect(variationId));
    });
  }

  // ---------- Buscador ----------

  onSearchInput(event: Event) {
    const term = (event.target as HTMLInputElement).value;
    this.$term.set(term);
    this.$isOpen.set(true);
    this.#term$.next(term);
  }

  onSearchFocus() {
    this.$isOpen.set(true);
    // Sin término muestra los primeros ítems.
    if (!this.$results().length && !this.$isSearching()) this.#term$.next(this.$term());
  }

  onSearchKeydown(event: KeyboardEvent) {
    const results = this.$results();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.$isOpen.set(true);
      this.$activeIndex.update((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.$activeIndex.update((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[this.$activeIndex()];
      if (this.$isOpen() && item) this.select(item);
    } else if (event.key === 'Escape') {
      this.$isOpen.set(false);
    }
  }

  closeResults() {
    this.$isOpen.set(false);
  }

  isAdded(item: StockableItem): boolean {
    return this.lines().controls.some((line) => line.controls.item.value.variationId === item.variationId);
  }

  select(item: StockableItem) {
    if (this.addItem(item)) {
      this.$term.set('');
      this.$isOpen.set(false);
      this.#term$.next('');
    }
  }

  /** Agrega una línea; avisa si la variación ya está o se llegó al máximo. */
  addItem(item: StockableItem): boolean {
    if (this.isAdded(item)) {
      this.#toast.show(`"${item.label}" ya está en la lista. Ajusta su cantidad.`, 'warning');
      return false;
    }
    if (this.lines().length >= MAX_STOCK_LINES) {
      this.#toast.show(`Puedes agregar hasta ${MAX_STOCK_LINES} ítems por documento.`, 'warning');
      return false;
    }
    this.lines().push(this.#createLine(item));
    this.#cdr.markForCheck();
    return true;
  }

  remove(index: number) {
    const line = this.lines().at(index);
    this.lines().removeAt(index);
    if (this.$lotOpen().has(line)) {
      this.$lotOpen.update((open) => {
        const next = new Set(open);
        next.delete(line);
        return next;
      });
    }
  }

  // ---------- Línea ----------

  unitOptions(item: StockableItem): UnitDto[] {
    return unitsForProduct(this.$units(), item.unitId);
  }

  onUnitChange(line: StockLineForm) {
    // Si el costo es el sugerido (no lo tocó el usuario), se convierte a la nueva unidad.
    const { item } = line.getRawValue();
    const cost = line.controls.unitCost;
    if (cost.pristine && item.defaultPurchasePrice !== null && this.costMode() === 'required') {
      cost.setValue(this.#round(item.defaultPurchasePrice * unitMultiplier(this.#unit(line))));
    }
  }

  toggleSign(line: StockLineForm) {
    const quantity = line.controls.quantity;
    if (quantity.value) quantity.setValue(-quantity.value);
    quantity.markAsTouched();
  }

  /** En modo signed el costo solo aplica si la línea suma. */
  costApplies(line: StockLineForm): boolean {
    if (this.costMode() === 'none') return false;
    return this.quantityMode() === 'positive' || Number(line.controls.quantity.value) > 0;
  }

  // ---------- Lote ----------

  lotApplies(line: StockLineForm): boolean {
    return lotApplies(line, this.lotMode());
  }

  isLotOpen(line: StockLineForm): boolean {
    const { lotNumber, expiryDate } = line.getRawValue();
    return this.$lotOpen().has(line) || !!lotNumber?.trim() || !!expiryDate;
  }

  toggleLot(line: StockLineForm) {
    this.$lotOpen.update((open) => {
      const next = new Set(open);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }

  lotError(line: StockLineForm): string | null {
    const errors = line.errors ?? {};
    if (errors['lotNumberLength']) return `El lote admite hasta ${MAX_LOT_NUMBER_LENGTH} caracteres.`;
    if (errors['expiryDateInvalid']) return 'La fecha de vencimiento no es válida.';
    return null;
  }

  /** Aviso (no bloquea): se puede registrar stock ya vencido, pero conviene revisarlo. */
  expiryWarning(line: StockLineForm): string | null {
    const expiry = line.controls.expiryDate.value;
    if (!expiry || !isValidIsoDate(expiry)) return null;
    return expiry < todayIsoDate() ? 'Esta fecha ya pasó: el lote quedará como vencido.' : null;
  }

  subtotal(line: StockLineForm): number | null {
    const { quantity, unitCost } = line.getRawValue();
    if (!this.costApplies(line) || quantity === null || unitCost === null) return null;
    return Number(quantity) * Number(unitCost);
  }

  readonly total = () => this.lines().controls.reduce((sum, line) => sum + (this.subtotal(line) ?? 0), 0);

  /** "= 2.000 g" cuando se carga en una subunidad. */
  baseEquivalent(line: StockLineForm): string | null {
    const unit = this.#unit(line);
    const quantity = line.controls.quantity.value;
    if (!unit?.baseUnitId || !quantity) return null;
    const base = this.$units().find((candidate) => candidate.id === unit.baseUnitId);
    return `= ${formatQuantity(quantity * unitMultiplier(unit), base?.shortName)}`;
  }

  baseUnitName(item: StockableItem): string | null {
    return this.$units().find((unit) => unit.id === item.unitId)?.shortName ?? null;
  }

  showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.showErrors());
  }

  quantityError(line: StockLineForm): string | null {
    const errors = line.errors ?? {};
    if (errors['quantityRequired']) return 'Ingresa la cantidad.';
    if (errors['quantityZero']) return 'La cantidad no puede ser 0.';
    if (errors['quantityPositive']) return 'La cantidad debe ser mayor a 0.';
    if (errors['quantityPrecision']) return 'Máximo 4 decimales.';
    if (errors['quantityDecimals']) return `"${errors['quantityDecimals']}" no permite decimales.`;
    return null;
  }

  costError(line: StockLineForm): string | null {
    const errors = line.errors ?? {};
    if (errors['costRequired']) return 'Ingresa el costo.';
    if (errors['costNegative']) return 'El costo no puede ser negativo.';
    return null;
  }

  isLineTouched(line: StockLineForm): boolean {
    return line.touched || this.showErrors();
  }

  // ---------- Privados ----------

  #createLine(item: StockableItem): StockLineForm {
    const suggested = this.costMode() === 'required' ? item.defaultPurchasePrice : null;
    const line: StockLineForm = new FormGroup(
      {
        item: new FormControl(item, { nonNullable: true, validators: Validators.required }),
        quantity: new FormControl<number | null>(null),
        unitId: new FormControl<number | null>(item.unitId),
        unitCost: new FormControl<number | null>(suggested ?? null),
        lotNumber: new FormControl('', { nonNullable: true }),
        expiryDate: new FormControl('', { nonNullable: true }),
      },
      { validators: (group) => this.#validateLine(group as StockLineForm) },
    );
    line.controls.unitId.valueChanges.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe(() => this.onUnitChange(line));
    return line;
  }

  #validateLine(line: StockLineForm): ValidationErrors | null {
    const { quantity, unitCost } = line.getRawValue();
    const errors: ValidationErrors = {};

    if (quantity === null || quantity === undefined || !Number.isFinite(Number(quantity))) {
      errors['quantityRequired'] = true;
    } else if (quantity === 0) {
      errors['quantityZero'] = true;
    } else if (this.quantityMode() === 'positive' && quantity < 0) {
      errors['quantityPositive'] = true;
    } else if (decimalsOf(quantity) > 4) {
      errors['quantityPrecision'] = true;
    } else {
      const unit = this.#unit(line);
      if (unit && !unit.allowDecimal && !Number.isInteger(quantity)) errors['quantityDecimals'] = unit.shortName;
    }

    if (this.costApplies(line)) {
      const hasCost = unitCost !== null && unitCost !== undefined && Number.isFinite(Number(unitCost));
      if (!hasCost && this.costMode() === 'required') errors['costRequired'] = true;
      else if (hasCost && unitCost! < 0) errors['costNegative'] = true;
    }

    // El lote solo se valida si aplica (si no, no se envía).
    if (lotApplies(line, this.lotMode())) {
      const { lotNumber, expiryDate } = line.getRawValue();
      if ((lotNumber ?? '').trim().length > MAX_LOT_NUMBER_LENGTH) errors['lotNumberLength'] = true;
      if (expiryDate && !isValidIsoDate(expiryDate)) errors['expiryDateInvalid'] = true;
    }

    return Object.keys(errors).length ? errors : null;
  }

  #unit(line: StockLineForm): UnitDto | null {
    const { item, unitId } = line.getRawValue();
    const id = unitId ?? item.unitId;
    return id ? (this.$units().find((unit) => unit.id === id) ?? null) : null;
  }

  #round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }

  // No hay búsqueda por id: se piden los primeros ítems y se filtra por la variación.
  #preselect(variationId: number) {
    this.#itemsService
      .search('', { includeIngredients: this.#settings.$ingredientsEnabled() }, 100)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (items) => {
          const item = items.find((candidate) => candidate.variationId === variationId);
          if (item) this.addItem(item);
          else this.#toast.show('No encontramos el ítem indicado. Búscalo en la lista.', 'warning');
        },
        error: () => this.#toast.show('No se pudo cargar el ítem indicado. Búscalo en la lista.', 'warning'),
      });
  }
}
