import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  formatMoney,
  formatQuantity,
  formatUnitCost,
  getInventoryErrorMessage,
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
  StockableItem,
  StockItemDto,
  todayIsoDate,
  TransferResultDto,
  unitMultiplier,
  UnitsService,
} from '../../data-access';
import {
  createStockLinesArray,
  StockLineForm,
  StockLineHint,
  StockLinesEditorComponent,
  toAdjustmentLines,
} from '../../features';
import { InventoryDisabledComponent } from '../../ui';
import { formatDocumentDate } from '../../shared';

function positiveId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function differentLocations(group: AbstractControl): ValidationErrors | null {
  const from = group.get('fromLocationId')?.value;
  const to = group.get('toLocationId')?.value;
  return from && to && from === to ? { sameLocation: true } : null;
}

/** Stock de un ítem en un local: undefined = sin pedir · 'loading' · null = no se pudo saber. */
type OriginStock = StockItemDto | 'loading' | null;

type SummaryLine = Readonly<{
  label: string;
  unitName: string | null;
  quantity: number;
  unitCost: number;
  fromBalanceAfter: number;
  toBalanceAfter: number;
  // Lotes que viajaron: "L-123 · vence 09-10-2026 · 2 kg".
  lots: string[];
}>;

type TransferSummary = Readonly<{
  documentId: number;
  totalCost: number;
  fromName: string;
  toName: string;
  lines: SummaryLine[];
}>;

const stockKey = (locationId: number, variationId: number) => `${locationId}:${variationId}`;

/**
 * Nueva transferencia entre locales. Sale del origen a su costo promedio y entra al destino a ese
 * costo. Query params opcionales: fromLocationId, variationId.
 */
@Component({
  selector: 'app-transfer-new',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    StockLinesEditorComponent,
  ],
  templateUrl: './transfer-new.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferNewComponent implements OnInit {
  readonly #fb = inject(FormBuilder);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #inventory = inject(InventoryService);
  readonly #units = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  protected readonly formatMoney = formatMoney;
  protected readonly formatUnitCost = formatUnitCost;
  protected readonly formatQuantity = formatQuantity;

  readonly form = this.#fb.group(
    {
      fromLocationId: this.#fb.control<number | null>(null, [Validators.required]),
      toLocationId: this.#fb.control<number | null>(null, [Validators.required]),
      documentDate: [todayIsoDate(), [Validators.required]],
      notes: ['', [Validators.maxLength(1000)]],
      lines: createStockLinesArray(),
    },
    { validators: differentLocations },
  );

  // Se limpia al empezar otra transferencia para que el editor nuevo no vuelva a precargar el ítem.
  readonly $preselectVariationId = signal(positiveId(this.#route.snapshot.queryParamMap.get('variationId')));
  readonly #queryFromLocationId = positiveId(this.#route.snapshot.queryParamMap.get('fromLocationId'));

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $summary = signal<TransferSummary | null>(null);
  readonly #disabledByServer = signal(false);

  readonly $locations = this.locationStore.$locations;
  readonly $isDisabled = computed(
    () => this.#disabledByServer() || (this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled()),
  );
  readonly $isLoading = computed(
    () =>
      !this.#settings.$isLoaded() ||
      (this.locationStore.$isLoading() && this.$locations().length === 0) ||
      (this.#units.$units() === null && !this.#units.$hasError()),
  );
  readonly $needsMoreLocations = computed(
    () => !this.locationStore.$isLoading() && !this.locationStore.$hasError() && this.$locations().length < 2,
  );
  readonly $allowNegativeStock = computed(() => this.#settings.$inventory().allowNegativeStock);

  readonly $fromLocationId = toSignal(
    this.form.controls.fromLocationId.valueChanges.pipe(startWith(this.form.controls.fromLocationId.value)),
    { initialValue: null },
  );
  readonly #lineItems = toSignal(
    this.form.controls.lines.valueChanges.pipe(
      startWith(null),
      map(() => this.form.controls.lines.controls.map((line) => line.controls.item.value)),
    ),
    { initialValue: [] as StockableItem[] },
  );
  readonly #originStock = signal<ReadonlyMap<string, OriginStock>>(new Map());

  constructor() {
    // Con los locales cargados: origen = query param o el local elegido en inventario; destino = otro local.
    effect(() => {
      const locations = this.$locations();
      if (locations.length < 2) return;
      untracked(() => {
        const { fromLocationId, toLocationId } = this.form.controls;
        const exists = (id: number | null) => !!id && locations.some((location) => location.id === id);
        if (!exists(fromLocationId.value)) {
          const preferred = [this.#queryFromLocationId, this.locationStore.$locationId()].find(exists) ?? locations[0].id;
          fromLocationId.setValue(preferred);
        }
        if (!exists(toLocationId.value) || toLocationId.value === fromLocationId.value) {
          toLocationId.setValue(locations.find((location) => location.id !== fromLocationId.value)?.id ?? null);
        }
      });
    });

    // Stock en el origen de cada ítem agregado (se pide una vez por local e ítem).
    effect(() => {
      const locationId = this.$fromLocationId();
      const items = this.#lineItems();
      if (!locationId) return;
      untracked(() => items.forEach((item) => this.#loadOriginStock(locationId, item)));
    });
  }

  ngOnInit(): void {
    this.#units.load();
  }

  /** "Stock en origen: 12 kg" bajo cada ítem; se destaca si la cantidad no alcanza. */
  readonly lineHint = (line: StockLineForm): StockLineHint | null => {
    const locationId = this.$fromLocationId();
    const { item, quantity } = line.getRawValue();
    if (!locationId) return null;
    const stock = this.#originStock().get(stockKey(locationId, item.variationId));
    if (stock === undefined || stock === null) return null;
    if (stock === 'loading') return { text: 'Stock en origen: cargando…' };
    const text = `Stock en origen: ${formatQuantity(stock.qtyAvailable, stock.unitName)}`;
    const units = this.#units.$units() ?? [];
    const unit = units.find((candidate) => candidate.id === (line.controls.unitId.value ?? item.unitId)) ?? null;
    const baseQuantity = Number(quantity ?? 0) * unitMultiplier(unit);
    if (baseQuantity > 0 && baseQuantity > stock.qtyAvailable) return { text: `${text} · no alcanza`, tone: 'warning' };
    return { text };
  };

  locationName(id: number | null): string {
    return this.$locations().find((location) => location.id === id)?.name ?? '—';
  }

  swapLocations() {
    const { fromLocationId, toLocationId } = this.form.controls;
    const from = fromLocationId.value;
    fromLocationId.setValue(toLocationId.value);
    toLocationId.setValue(from);
  }

  /** Vuelve al formulario vacío para otra transferencia (mantiene origen y destino). */
  startAnother() {
    this.$summary.set(null);
    this.$preselectVariationId.set(null);
    this.$submitted.set(false);
    this.form.controls.lines.clear();
    this.form.controls.notes.reset('');
    this.form.controls.documentDate.reset(todayIsoDate());
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    const { fromLocationId, toLocationId } = this.form.getRawValue();
    if (!fromLocationId || !toLocationId) {
      this.#toast.show('Elige el origen y el destino.', 'warning');
      return;
    }
    if (fromLocationId === toLocationId) {
      this.#toast.show('El origen y el destino deben ser locales distintos.', 'warning');
      return;
    }
    if (!this.form.controls.lines.length) {
      this.#toast.show('Agrega al menos un ítem.', 'warning');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados.', 'warning');
      return;
    }

    const value = this.form.getRawValue();
    const notes = value.notes?.trim();
    // Nombre y unidad base de cada ítem para el resumen (la respuesta solo trae variationId).
    const labels = new Map(
      this.form.controls.lines.controls.map((line) => {
        const item = line.controls.item.value;
        return [item.variationId, { label: item.label, unitName: this.#baseUnitName(item) }] as const;
      }),
    );
    this.$isSaving.set(true);
    this.#inventory
      .createTransfer({
        fromLocationId,
        toLocationId,
        ...(value.documentDate ? { documentDate: value.documentDate } : {}),
        ...(notes ? { notes } : {}),
        // Mismo formato que un ajuste sin costo: variationId, quantity y unitId opcional.
        lines: toAdjustmentLines(this.form.controls.lines, 'none'),
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.$isSaving.set(false);
          this.#toast.show(`Transferencia registrada por ${formatMoney(result.totalCost)}`, 'success');
          this.$summary.set(this.#toSummary(result, fromLocationId, toLocationId, labels));
          // El stock de ambos locales cambió: se vuelve a pedir si se hace otra transferencia.
          this.#originStock.set(new Map());
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        // Si falla, el formulario queda intacto.
        error: (error) => {
          this.$isSaving.set(false);
          if (isInventoryDisabledError(error)) {
            this.#disabledByServer.set(true);
            return;
          }
          this.#toast.show(getInventoryErrorMessage(error), 'error');
        },
      });
  }

  openDocument(documentId: number) {
    this.#router.navigate(['/inventory/documents', documentId]);
  }

  #toSummary(
    result: TransferResultDto,
    fromLocationId: number,
    toLocationId: number,
    labels: ReadonlyMap<number, { label: string; unitName: string | null }>,
  ): TransferSummary {
    return {
      documentId: result.documentId,
      totalCost: result.totalCost,
      fromName: this.locationName(fromLocationId),
      toName: this.locationName(toLocationId),
      lines: result.lines.map((line) => ({
        label: labels.get(line.variationId)?.label ?? `Variación #${line.variationId}`,
        unitName: labels.get(line.variationId)?.unitName ?? null,
        quantity: line.quantity,
        unitCost: line.unitCost,
        fromBalanceAfter: line.fromBalanceAfter,
        toBalanceAfter: line.toBalanceAfter,
        lots: (line.lots ?? []).map((lot) =>
          [
            lot.lotNumber ? `Lote ${lot.lotNumber}` : 'Sin número',
            lot.expiryDate ? `vence ${formatDocumentDate(lot.expiryDate)}` : 'sin vencimiento',
            formatQuantity(lot.quantity, labels.get(line.variationId)?.unitName),
          ].join(' · '),
        ),
      })),
    };
  }

  #baseUnitName(item: StockableItem): string | null {
    return (this.#units.$units() ?? []).find((unit) => unit.id === item.unitId)?.shortName ?? null;
  }

  // No hay búsqueda por variación: se busca por SKU (o nombre) en el stock del local y se filtra.
  #loadOriginStock(locationId: number, item: StockableItem) {
    const key = stockKey(locationId, item.variationId);
    if (this.#originStock().has(key)) return;
    this.#setOriginStock(key, 'loading');
    const search = item.sku || item.label.split(' · ')[0];
    this.#inventory
      .getStock({ locationId, search, page: 1, perPage: 50 })
      .pipe(
        map((response) => response.data.find((stock) => stock.variationId === item.variationId) ?? null),
        catchError(() => of(null)),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((stock) => this.#setOriginStock(key, stock));
  }

  #setOriginStock(key: string, value: OriginStock) {
    this.#originStock.update((current) => new Map(current).set(key, value));
  }
}
