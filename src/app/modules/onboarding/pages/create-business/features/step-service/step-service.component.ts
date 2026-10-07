import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, from, map, mergeMap, of, tap, toArray } from 'rxjs';
import { ButtonComponent, IconComponent, ToastService } from 'src/ui';
import { OnboardingApiService, ServiceMode, ServiceResult } from '../../../../data-access';

const MIN_TABLES = 1;
const MAX_TABLES = 50;
// Mesas creadas en paralelo (sin saturar al backend).
const CONCURRENCY = 3;

/** Paso "¿Cómo atiendes?": mostrador, mesas o ambos; con mesas crea un sector y "Mesa 1..N". */
@Component({
  selector: 'app-step-service',
  templateUrl: './step-service.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, IconComponent],
})
export class StepServiceComponent {
  readonly #api = inject(OnboardingApiService);
  readonly #toast = inject(ToastService);

  readonly locationId = input.required<number>();
  readonly completed = output<ServiceResult>();
  readonly busyChange = output<boolean>();

  readonly modes: ReadonlyArray<{ id: ServiceMode; icon: string; label: string; hint: string }> = [
    { id: 'counter', icon: 'storefront', label: 'Mostrador', hint: 'Para llevar, delivery o pago en caja' },
    { id: 'tables', icon: 'table_restaurant', label: 'Mesas', hint: 'Atención con garzones en el salón' },
    { id: 'both', icon: 'deck', label: 'Ambos', hint: 'Mesas y también mostrador' },
  ];

  readonly $mode = signal<ServiceMode | null>(null);
  readonly $usesTables = computed(() => this.$mode() === 'tables' || this.$mode() === 'both');
  readonly $sectorName = signal('Salón');
  readonly $tables = signal(6);
  readonly $capacity = signal(4);

  readonly $isSaving = signal(false);
  readonly $progress = signal<{ done: number; total: number } | null>(null);
  readonly $progressPercent = computed(() => {
    const progress = this.$progress();
    return progress ? Math.round((progress.done / progress.total) * 100) : 0;
  });

  stepTables(delta: number) {
    this.$tables.update((value) => clamp(value + delta, MIN_TABLES, MAX_TABLES));
  }

  setTables(value: number) {
    this.$tables.set(clamp(Math.round(Number(value) || MIN_TABLES), MIN_TABLES, MAX_TABLES));
  }

  stepCapacity(delta: number) {
    this.$capacity.update((value) => clamp(value + delta, 1, 30));
  }

  confirm() {
    const mode = this.$mode();
    if (!mode) {
      this.#toast.show('Elige cómo atiendes', 'warning');
      return;
    }
    if (!this.$usesTables()) {
      this.completed.emit({ mode, sectorName: null, tablesCreated: 0 });
      return;
    }
    const sectorName = this.$sectorName().trim() || 'Salón';
    const total = this.$tables();
    const capacity = this.$capacity();
    const locationId = this.locationId();

    this.#setBusy(true);
    this.$progress.set({ done: 0, total });

    // Si el sector falla, las mesas se crean igual (sin sector).
    this.#api
      .createSector({ name: sectorName, locationId })
      .pipe(
        map(({ id }) => id as number | null),
        catchError(() => {
          this.#toast.show(`No se pudo crear el sector "${sectorName}", las mesas quedan sin sector`, 'warning');
          return of(null);
        }),
        mergeMap((sectorId) =>
          from(Array.from({ length: total }, (_, index) => index + 1)).pipe(
            mergeMap(
              (number) =>
                this.#api
                  .createTable({ name: `Mesa ${number}`, locationId, capacity, ...(sectorId ? { sectorId } : {}) })
                  .pipe(
                    map(() => true),
                    catchError(() => of(false)),
                    tap(() => this.$progress.update((progress) => progress && { ...progress, done: progress.done + 1 })),
                  ),
              CONCURRENCY,
            ),
            toArray(),
            map((results) => ({ sectorId, created: results.filter(Boolean).length })),
          ),
        ),
      )
      .subscribe(({ sectorId, created }) => {
        this.#setBusy(false);
        this.$progress.set(null);
        if (created < total) {
          const failed = total - created;
          this.#toast.show(
            `${failed === 1 ? 'No se pudo crear 1 mesa' : `No se pudieron crear ${failed} mesas`}. Puedes agregarlas después en Mesas.`,
            'warning',
          );
        }
        this.completed.emit({ mode, sectorName: sectorId ? sectorName : null, tablesCreated: created });
      });
  }

  #setBusy(busy: boolean) {
    this.$isSaving.set(busy);
    this.busyChange.emit(busy);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
