import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { InventoryLocationStore } from 'src/app/modules/inventory/data-access';
import { formatDocumentDate, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
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
  ExpenseCategoryDto,
  ExpensesService,
  getFinanceErrorMessage,
  recurrenceLabel,
  RecurringExpenseDto,
} from '../../data-access';
import { openRecurringModal } from '../../features/recurring-modal';

/** Gastos que se repiten (arriendo, sueldos, servicios): se generan solos como pendientes en cada fecha. */
@Component({
  selector: 'app-recurring-expenses',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recurring-expenses.component.html',
})
export class RecurringExpensesComponent {
  readonly #expenses = inject(ExpensesService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  protected readonly locationStore = inject(InventoryLocationStore);

  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDocumentDate;
  readonly recurrenceLabel = recurrenceLabel;
  readonly skeletonRows = [1, 2, 3];

  readonly $includeInactive = signal(true);
  readonly $busyId = signal<number | null>(null);

  readonly recurring = rxResource({
    params: () => ({ includeInactive: this.$includeInactive() }),
    stream: ({ params }) => this.#expenses.getRecurring(params).pipe(toRemoteResult()),
  });
  readonly $items = computed(() => resultValue(this.recurring.value()));
  readonly $error = computed(() => resultError(this.recurring.value()));

  // Todas (las inactivas se muestran en el modal solo si son la actual).
  readonly #categories = rxResource({
    stream: () => this.#expenses.getCategories(true).pipe(toRemoteResult()),
  });
  readonly $categories = computed<readonly ExpenseCategoryDto[]>(() => resultValue(this.#categories.value()) ?? []);

  handleCreate() {
    this.#openModal();
  }

  handleEdit(item: RecurringExpenseDto) {
    this.#openModal(item);
  }

  handleToggle(item: RecurringExpenseDto) {
    if (this.$busyId()) return;
    const isActive = !item.isActive;
    const data: ConfirmModalData = isActive
      ? {
          title: 'Reanudar gasto recurrente',
          message:
            'Se volverán a generar los gastos de esta plantilla. Las fechas que pasaron mientras estaba pausado se crearán como gastos pendientes; si no corresponden, anúlalos.',
          confirmText: 'Reanudar',
        }
      : {
          title: 'Pausar gasto recurrente',
          message: 'Dejará de generar gastos nuevos. Los que ya se generaron no cambian.',
          confirmText: 'Pausar',
          tone: 'danger',
        };
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { width: '440px', maxWidth: '95vw', data })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => {
          this.$busyId.set(item.id);
          // El backend exige el registro completo.
          return this.#expenses.updateRecurring(item.id, {
            locationId: item.locationId,
            categoryId: item.categoryId,
            supplierId: item.supplierId,
            description: item.description,
            amount: item.amount,
            vatAmount: item.vatAmount,
            documentType: item.documentType,
            frequency: item.frequency,
            dayOfPeriod: item.dayOfPeriod,
            startDate: item.startDate.slice(0, 10),
            endDate: item.endDate ? item.endDate.slice(0, 10) : null,
            dueDays: item.dueDays,
            isActive,
          });
        }),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.#toast.show(isActive ? 'Gasto recurrente reanudado' : 'Gasto recurrente pausado', 'success');
          this.recurring.reload();
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          this.#toast.show(getFinanceErrorMessage(error, 'No se pudo actualizar el gasto recurrente'), 'error');
        },
      });
  }

  #openModal(recurring?: RecurringExpenseDto) {
    const locations = this.locationStore.$locations();
    if (!locations.length) {
      this.#toast.show(this.locationStore.$isLoading() ? 'Cargando locales…' : 'No hay locales disponibles', 'warning');
      return;
    }
    if (!this.$categories().length) {
      this.#toast.show(this.#categories.isLoading() ? 'Cargando categorías…' : 'No se pudieron cargar las categorías', 'warning');
      if (!this.#categories.isLoading()) this.#categories.reload();
      return;
    }
    openRecurringModal(this.#dialog, {
      recurring,
      categories: this.$categories(),
      locations,
      defaultLocationId: this.locationStore.$locationId(),
    }).subscribe((result) => {
        if (!result) return;
        if (result.kind === 'created') {
          const { generated } = result;
          this.#toast.show(
            generated > 0
              ? `Gasto recurrente creado. Se ${generated === 1 ? 'generó 1 gasto pendiente' : `generaron ${generated} gastos pendientes`}`
              : 'Gasto recurrente creado',
            'success',
          );
        }
        this.recurring.reload();
      });
  }
}
