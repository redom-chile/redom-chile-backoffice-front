import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  ADJUSTMENT_REASONS,
  AdjustmentReason,
  AdjustmentReasonOption,
  getInventoryErrorMessage,
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
  todayIsoDate,
  UnitsService,
} from '../../data-access';
import {
  createStockLinesArray,
  StockLineCostMode,
  StockLineLotMode,
  StockLineQuantityMode,
  StockLinesEditorComponent,
  toAdjustmentLines,
} from '../../features';
import { InventoryDisabledComponent, LocationSelectComponent } from '../../ui';

function positiveId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toReason(value: string | null): AdjustmentReason | null {
  return ADJUSTMENT_REASONS.find((reason) => reason.value === value)?.value ?? null;
}

// El lote solo aplica a lo que suma: stock inicial siempre, correcciones solo en líneas +.
const LINE_MODES: Record<
  AdjustmentReasonOption['direction'],
  { quantity: StockLineQuantityMode; cost: StockLineCostMode; lot: StockLineLotMode }
> = {
  exit: { quantity: 'positive', cost: 'none', lot: 'none' },
  entry: { quantity: 'positive', cost: 'optional', lot: 'entry' },
  signed: { quantity: 'signed', cost: 'optional', lot: 'signed' },
};

/** Nuevo ajuste: merma, consumo interno, stock inicial o corrección. Query params: variationId, reason, locationId. */
@Component({
  selector: 'app-adjustment-new',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    LocationSelectComponent,
    StockLinesEditorComponent,
  ],
  templateUrl: './adjustment-new.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdjustmentNewComponent implements OnInit {
  readonly #fb = inject(FormBuilder);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #inventory = inject(InventoryService);
  readonly #units = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  protected readonly reasons = ADJUSTMENT_REASONS;

  readonly form = this.#fb.group({
    reason: this.#fb.control<AdjustmentReason | null>(toReason(this.#route.snapshot.queryParamMap.get('reason')), [
      Validators.required,
    ]),
    documentDate: [todayIsoDate(), [Validators.required]],
    notes: ['', [Validators.maxLength(1000)]],
    lines: createStockLinesArray(),
  });

  readonly preselectVariationId = positiveId(this.#route.snapshot.queryParamMap.get('variationId'));

  readonly $reasonValue = toSignal(this.form.controls.reason.valueChanges, {
    initialValue: this.form.controls.reason.value,
  });
  readonly $reason = computed(() => ADJUSTMENT_REASONS.find((reason) => reason.value === this.$reasonValue()) ?? null);
  // Sin motivo elegido, el editor trabaja como salida (sin costo).
  readonly $lineMode = computed(() => LINE_MODES[this.$reason()?.direction ?? 'exit']);
  readonly $notesRequired = computed(() => this.$reason()?.requiresNotes ?? false);
  readonly $allowNegativeStock = computed(() => this.#settings.$inventory().allowNegativeStock);

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly #disabledByServer = signal(false);

  readonly $isDisabled = computed(
    () => this.#disabledByServer() || (this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled()),
  );
  readonly $isLoading = computed(
    () => !this.#settings.$isLoaded() || (this.#units.$units() === null && !this.#units.$hasError()),
  );

  constructor() {
    // Nota obligatoria para merma y otro.
    this.form.controls.reason.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.#syncNotesValidators());
    this.#syncNotesValidators();
  }

  ngOnInit(): void {
    const locationId = positiveId(this.#route.snapshot.queryParamMap.get('locationId'));
    if (locationId) this.locationStore.select(locationId);
    this.#units.load();
  }

  notesInvalid(): boolean {
    const notes = this.form.controls.notes;
    return notes.invalid && (notes.touched || this.$submitted());
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    const locationId = this.locationStore.$locationId();
    const reason = this.form.controls.reason.value;
    if (!locationId) {
      this.#toast.show('Elige un local.', 'warning');
      return;
    }
    if (!reason) {
      this.#toast.show('Elige el motivo del ajuste.', 'warning');
      return;
    }
    if (!this.form.controls.lines.length) {
      this.#toast.show('Agrega al menos un ítem.', 'warning');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show(
        this.form.controls.notes.invalid && this.$notesRequired()
          ? `Para "${this.$reason()?.label}" explica el motivo en la nota.`
          : 'Revisa los campos marcados.',
        'warning',
      );
      return;
    }

    const value = this.form.getRawValue();
    const notes = value.notes?.trim();
    this.$isSaving.set(true);
    this.#inventory
      .createAdjustment({
        locationId,
        reason,
        ...(value.documentDate ? { documentDate: value.documentDate } : {}),
        ...(notes ? { notes } : {}),
        lines: toAdjustmentLines(this.form.controls.lines, this.$lineMode().cost, this.$lineMode().lot),
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.#toast.show('Ajuste registrado', 'success');
          this.#router.navigate(['/inventory/documents', result.documentId]);
        },
        // 409 "Not enough stock" u otro error: toast traducido y el formulario queda intacto.
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

  #syncNotesValidators() {
    const notes = this.form.controls.notes;
    const required = ADJUSTMENT_REASONS.find((reason) => reason.value === this.form.controls.reason.value)?.requiresNotes;
    // Validators.required no rechaza solo espacios: se valida el texto recortado.
    notes.setValidators(
      required
        ? [Validators.maxLength(1000), (control) => (String(control.value ?? '').trim() ? null : { required: true })]
        : [Validators.maxLength(1000)],
    );
    notes.updateValueAndValidity();
  }
}
