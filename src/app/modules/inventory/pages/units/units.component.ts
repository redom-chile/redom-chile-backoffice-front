import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { concatMap, from, last, Observable, of } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  EmptyStateComponent,
  HeaderDashboardComponent,
  IconComponent,
  SkeletonComponent,
  ToastService,
} from 'src/ui';
import { CreateUnitDto, getInventoryErrorMessage, UnitDto, UnitsService } from '../../data-access';
import { InventoryDisabledComponent } from '../../ui';
import { UnitModalComponent, UnitModalData, UnitModalResult } from './features';
import { UnitsListComponent } from './ui';

/** Unidades sugeridas para empezar: unidades base y sus subunidades más comunes. */
const SUGGESTED_UNITS: ReadonlyArray<Readonly<{ base: CreateUnitDto; subunits: CreateUnitDto[] }>> = [
  {
    base: { actualName: 'Gramo', shortName: 'g', allowDecimal: true },
    subunits: [{ actualName: 'Kilogramo', shortName: 'kg', allowDecimal: true, baseUnitMultiplier: '1000' }],
  },
  {
    base: { actualName: 'Mililitro', shortName: 'ml', allowDecimal: true },
    subunits: [{ actualName: 'Litro', shortName: 'l', allowDecimal: true, baseUnitMultiplier: '1000' }],
  },
  { base: { actualName: 'Unidad', shortName: 'un', allowDecimal: false }, subunits: [] },
];

@Component({
  selector: 'app-units',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    UnitsListComponent,
  ],
  templateUrl: './units.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnitsComponent implements OnInit {
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #units = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);

  readonly $settingsLoaded = this.#settings.$isLoaded;
  readonly $inventoryEnabled = this.#settings.$inventoryEnabled;
  readonly $units = this.#units.$units;
  readonly $hasError = computed(() => this.#units.$hasError() && !this.#units.$units());
  readonly $isLoading = computed(() => this.#units.$units() === null && !this.#units.$hasError());
  readonly $isEmpty = computed(() => this.#units.$units()?.length === 0);
  readonly $isCreatingSuggested = signal(false);

  ngOnInit(): void {
    // Siempre se refresca al entrar (otra persona pudo crear unidades).
    this.#units.load(true);
  }

  handleRetry() {
    this.#units.load(true);
  }

  handleCreate() {
    this.#openModal({ units: this.$units() ?? [] });
  }

  handleEdit(unit: UnitDto) {
    this.#openModal({ unit, units: this.$units() ?? [] });
  }

  handleDelete(unit: UnitDto) {
    const units = this.$units() ?? [];
    const subunits = units.filter((other) => other.baseUnitId === unit.id);
    if (subunits.length) {
      this.#toast.show(`Primero elimina sus subunidades: ${subunits.map((sub) => sub.actualName).join(', ')}.`, 'warning');
      return;
    }
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar unidad',
          message: `¿Eliminar "${unit.actualName}"? Revisa antes que ningún producto o ingrediente la use.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.#units.delete(unit.id).subscribe({
          next: () => this.#toast.show('Unidad eliminada', 'success'),
          error: (error) => this.#toast.show(getInventoryErrorMessage(error, 'No se pudo eliminar la unidad.'), 'error'),
        });
      });
  }

  /** Crea Gramo/Kilogramo, Mililitro/Litro y Unidad (cada subunidad necesita el id de su base). */
  createSuggested() {
    this.$isCreatingSuggested.set(true);
    from(SUGGESTED_UNITS)
      .pipe(
        concatMap(({ base, subunits }) =>
          this.#units.create(base).pipe(
            concatMap(({ id }): Observable<unknown> =>
              subunits.length ? from(subunits).pipe(concatMap((sub) => this.#units.create({ ...sub, baseUnitId: id }))) : of(null),
            ),
          ),
        ),
        last(),
      )
      .subscribe({
        next: () => {
          this.$isCreatingSuggested.set(false);
          this.#toast.show('Unidades creadas', 'success');
        },
        error: (error) => {
          this.$isCreatingSuggested.set(false);
          this.#units.load(true);
          this.#toast.show(getInventoryErrorMessage(error, 'No se pudieron crear todas las unidades.'), 'error');
        },
      });
  }

  #openModal(data: UnitModalData) {
    this.#dialog
      .open<UnitModalComponent, UnitModalData, UnitModalResult>(UnitModalComponent, {
        width: '560px',
        maxWidth: '95vw',
        disableClose: true,
        data,
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.#toast.show(result === 'created' ? 'Unidad creada' : 'Unidad actualizada', 'success');
      });
  }
}
