import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  HeaderDashboardComponent,
  IconComponent,
  SkeletonComponent,
  ToastService,
} from 'src/ui';
import {
  CountResultDto,
  CreateCountLineDto,
  formatQuantity,
  formatSignedQuantity,
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
  todayIsoDate,
  UnitDto,
  unitLabel,
  UnitsService,
} from '../../data-access';
import { LoadErrorComponent, resultError, resultValue, toRemoteResult } from '../../shared';
import { InventoryDisabledComponent, LocationSelectComponent } from '../../ui';
import {
  CountKindFilter,
  CountSheetItem,
  getCountErrorMessage,
  loadCountSheet,
  MAX_COUNT_LINES,
  ParsedCount,
  parseCount,
  roundQuantity,
  selectedUnit,
  toBaseQuantity,
  toCountSheet,
} from './data-access';
import { CountSummaryComponent } from './ui';

const NOTES_MAX = 1000;

/** Estado de una fila según lo ingresado. */
type CountRowView = Readonly<{
  item: CountSheetItem;
  raw: string;
  unit: UnitDto | null;
  parsed: ParsedCount;
  // Diferencia en unidad base (solo si la cantidad es válida).
  difference: number | null;
}>;

type CountSuccess = Readonly<{
  result: CountResultDto;
  items: ReadonlyMap<number, CountSheetItem>;
  locationName: string;
  documentDate: string;
}>;

function positiveId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Conteo físico (toma de inventario) de un local. La planilla trae todos los ítems con stock propio;
 * solo se envían los contados. Por defecto es un conteo ciego (no muestra el stock del sistema).
 * Query param: locationId.
 */
@Component({
  selector: 'app-count-new',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    LocationSelectComponent,
    LoadErrorComponent,
    CountSummaryComponent,
  ],
  templateUrl: './count-new.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class CountNewComponent implements OnInit {
  readonly #route = inject(ActivatedRoute);
  readonly #toast = inject(ToastService);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #inventory = inject(InventoryService);
  readonly #units = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  readonly notesMax = NOTES_MAX;
  readonly unitLabel = unitLabel;
  readonly formatQuantity = formatQuantity;
  readonly formatSignedQuantity = formatSignedQuantity;

  // Datos del conteo
  readonly $documentDate = signal(todayIsoDate());
  readonly $notes = signal('');

  // Filtros de la planilla (en el cliente)
  readonly $kind = signal<CountKindFilter>('all');
  readonly $search = signal('');
  readonly $onlyCounted = signal(false);
  readonly $showSystem = signal(false);

  // Lo ingresado por variationId: texto contado y unidad elegida.
  readonly $counted = signal<ReadonlyMap<number, string>>(new Map());
  readonly $unitIds = signal<ReadonlyMap<number, number>>(new Map());

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $success = signal<CountSuccess | null>(null);
  readonly #disabledByServer = signal(false);

  readonly #isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());
  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;

  readonly sheet = rxResource({
    params: () => {
      const locationId = this.locationStore.$locationId();
      if (this.#isDisabledBySettings() || !locationId) return undefined;
      return { locationId };
    },
    stream: ({ params }) => loadCountSheet(this.#inventory, params.locationId).pipe(toRemoteResult()),
  });

  readonly #sheetError = computed(() => resultError(this.sheet.value()));
  readonly $sheetError = computed(() => (isInventoryDisabledError(this.#sheetError()) ? null : this.#sheetError()));
  readonly $isDisabled = computed(
    () => this.#disabledByServer() || this.#isDisabledBySettings() || isInventoryDisabledError(this.#sheetError()),
  );
  readonly $isLoading = computed(
    () =>
      !this.#settings.$isLoaded() ||
      (this.#units.$units() === null && !this.#units.$hasError()) ||
      (this.locationStore.$isLoading() && !this.locationStore.$locationId()),
  );

  readonly $items = computed(() => toCountSheet(resultValue(this.sheet.value()) ?? [], this.#units.$units() ?? []));

  readonly $rows = computed((): CountRowView[] => {
    const counted = this.$counted();
    const unitIds = this.$unitIds();
    return this.$items().map((item) => {
      const raw = counted.get(item.variationId) ?? '';
      const unit = selectedUnit(item, unitIds.get(item.variationId));
      const parsed = parseCount(raw, unit);
      const difference =
        parsed.state === 'valid' ? roundQuantity(toBaseQuantity(parsed.quantity, item, unit) - item.systemQuantity) : null;
      return { item, raw, unit, parsed, difference };
    });
  });

  readonly $visibleRows = computed(() => {
    const kind = this.$kind();
    const search = this.$search().trim().toLocaleLowerCase('es');
    const onlyCounted = this.$onlyCounted();
    return this.$rows().filter(({ item, parsed }) => {
      if (kind === 'ingredient' && !item.isIngredient) return false;
      if (kind === 'product' && item.isIngredient) return false;
      if (onlyCounted && parsed.state === 'empty') return false;
      if (!search) return true;
      return item.label.toLocaleLowerCase('es').includes(search) || item.sku.toLocaleLowerCase('es').includes(search);
    });
  });

  readonly $countedRows = computed(() => this.$rows().filter((row) => row.parsed.state !== 'empty'));
  readonly $countedCount = computed(() => this.$countedRows().length);
  readonly $invalidCount = computed(() => this.$countedRows().filter((row) => row.parsed.state === 'invalid').length);
  readonly $hasCounted = computed(() => this.$countedCount() > 0);
  readonly $hasFilters = computed(() => this.$kind() !== 'all' || !!this.$search().trim() || this.$onlyCounted());

  ngOnInit(): void {
    const locationId = positiveId(this.#route.snapshot.queryParamMap.get('locationId'));
    if (locationId) this.locationStore.select(locationId);
    this.#units.load();
  }

  handleCountInput(variationId: number, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$counted.update((map) => {
      const next = new Map(map);
      if (value.trim()) next.set(variationId, value);
      else next.delete(variationId);
      return next;
    });
  }

  handleUnitChange(variationId: number, event: Event) {
    const unitId = Number((event.target as HTMLSelectElement).value);
    this.$unitIds.update((map) => new Map(map).set(variationId, unitId));
  }

  handleKindChange(event: Event) {
    this.$kind.set((event.target as HTMLSelectElement).value as CountKindFilter);
  }

  handleClearFilters() {
    this.$kind.set('all');
    this.$search.set('');
    this.$onlyCounted.set(false);
  }

  /** Vacía lo contado (también permite cambiar de local). */
  handleClearCounts() {
    this.$counted.set(new Map());
    this.$unitIds.set(new Map());
    this.$submitted.set(false);
  }

  rowError(row: CountRowView): string | null {
    if (row.parsed.state !== 'invalid') return null;
    return row.parsed.error === 'integer'
      ? `"${row.unit?.shortName}" no permite decimales.`
      : 'Ingresa un número mayor o igual a 0, con hasta 4 decimales.';
  }

  differenceClass(difference: number | null): string {
    if (difference === null || difference === 0) return 'text-muted-foreground';
    return difference < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    const location = this.locationStore.$location();
    if (!location) {
      this.#toast.show('Elige un local.', 'warning');
      return;
    }
    if (!this.$documentDate()) {
      this.#toast.show('Elige la fecha del conteo.', 'warning');
      return;
    }
    if (this.$notes().length > NOTES_MAX) {
      this.#toast.show(`Las notas admiten hasta ${NOTES_MAX} caracteres.`, 'warning');
      return;
    }
    const rows = this.$countedRows();
    if (!rows.length) {
      this.#toast.show('Ingresa la cantidad contada de al menos un ítem.', 'warning');
      return;
    }
    if (this.$invalidCount() > 0) {
      // Deja visibles las filas con error.
      this.$onlyCounted.set(true);
      this.#toast.show('Revisa las cantidades marcadas.', 'warning');
      return;
    }
    if (rows.length > MAX_COUNT_LINES) {
      this.#toast.show(`Un conteo admite hasta ${MAX_COUNT_LINES} ítems; divídelo en varios conteos.`, 'warning');
      return;
    }

    const lines: CreateCountLineDto[] = rows.map(({ item, unit, parsed }) => ({
      variationId: item.variationId,
      countedQuantity: parsed.state === 'valid' ? parsed.quantity : 0,
      ...(unit && unit.id !== item.baseUnitId ? { unitId: unit.id } : {}),
    }));

    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Confirmar conteo',
          message:
            `Se registrará el conteo de ${lines.length} ${lines.length === 1 ? 'ítem' : 'ítems'} en ${location.name}. ` +
            'El stock de esos ítems quedará igual a lo contado; los no contados no cambian.',
          confirmText: 'Confirmar conteo',
          cancelText: 'Volver',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.#send(location.id, location.name, lines);
      });
  }

  handleNewCount() {
    this.$success.set(null);
    this.handleClearCounts();
    this.$notes.set('');
    this.$documentDate.set(todayIsoDate());
    // El stock cambió con el conteo anterior.
    this.sheet.reload();
  }

  hasUnsavedChanges(): boolean {
    return this.$hasCounted() && !this.$success();
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.$hasCounted() || this.$success()) return;
    event.preventDefault();
    // Navegadores antiguos requieren returnValue.
    event.returnValue = '';
  }

  #send(locationId: number, locationName: string, lines: CreateCountLineDto[]) {
    const notes = this.$notes().trim();
    const documentDate = this.$documentDate();
    // Nombres y unidades para el resumen (la respuesta solo trae ids).
    const items = new Map(this.$items().map((item) => [item.variationId, item]));
    this.$isSaving.set(true);
    this.#inventory
      .createCount({ locationId, documentDate, ...(notes ? { notes } : {}), lines })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.$isSaving.set(false);
          this.$success.set({ result, items, locationName, documentDate });
          this.handleClearCounts();
          this.#toast.show('Conteo registrado', 'success');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        // Lo ingresado se mantiene para reintentar.
        error: (error) => {
          this.$isSaving.set(false);
          if (isInventoryDisabledError(error)) {
            this.#disabledByServer.set(true);
            return;
          }
          this.#toast.show(getCountErrorMessage(error), 'error');
        },
      });
  }
}
