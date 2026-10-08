import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, tap } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  EXPENSE_DOCUMENT_LABELS,
  EXPENSE_STATUS_CLASSES,
  EXPENSE_STATUS_LABELS,
  ExpenseDto,
  ExpensesService,
  getFinanceErrorMessage,
} from '../../data-access';
import { openCancelExpenseModal } from '../../features/cancel-expense-modal';
import { formatDay, formatPaidAt, openPayPayableModal, PayablePaymentsComponent } from '../../features';

// La URL del adjunto es temporal: pasado este tiempo se pide una nueva antes de abrirlo.
const DOCUMENT_URL_TTL_MS = 4 * 60_000;

/** Detalle de un gasto: datos, montos, adjunto, pagos y acciones (pagar, editar, anular). */
@Component({
  selector: 'app-expense-detail',
  imports: [RouterLink, ButtonComponent, IconComponent, SkeletonComponent, PayablePaymentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-detail.component.html',
})
export class ExpenseDetailComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);
  readonly #expenses = inject(ExpensesService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatCurrency = formatCurrency;
  readonly formatDay = formatDay;
  readonly formatPaidAt = formatPaidAt;
  readonly statusLabels = EXPENSE_STATUS_LABELS;
  readonly statusClasses = EXPENSE_STATUS_CLASSES;
  readonly documentLabels = EXPENSE_DOCUMENT_LABELS;

  readonly $id = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('id')))), {
    initialValue: Number(this.#route.snapshot.paramMap.get('id')),
  });
  readonly $isValidId = computed(() => Number.isInteger(this.$id()) && this.$id() > 0);

  #loadedAt = 0;
  readonly $isOpeningDocument = signal(false);

  readonly expense = rxResource({
    params: () => (this.$isValidId() ? this.$id() : undefined),
    stream: ({ params }) =>
      this.#expenses.get(params).pipe(
        tap(() => (this.#loadedAt = Date.now())),
        toRemoteResult(),
      ),
  });

  readonly $expense = computed(() => resultValue(this.expense.value()));
  readonly $error = computed(() => resultError(this.expense.value()));
  readonly $isNotFound = computed(() => !!this.$error() && readApiError(this.$error()).status === 404);
  readonly $errorMessage = computed(() => getFinanceErrorMessage(this.$error(), 'No se pudo cargar el gasto.'));

  readonly $isCancelled = computed(() => this.$expense()?.status === 'cancelled');
  readonly $canPay = computed(() => {
    const expense = this.$expense();
    return !!expense && !this.$isCancelled() && expense.balance > 0;
  });
  readonly $hasActivePayments = computed(() => (this.$expense()?.payments ?? []).some((payment) => !payment.cancelled));

  pay(expense: ExpenseDto) {
    openPayPayableModal(this.#dialog, {
      type: 'expense',
      id: expense.id,
      description: expense.description,
      balance: expense.balance,
      locationId: expense.locationId,
    }).subscribe((result) => {
      if (result) this.expense.reload();
    });
  }

  cancelExpense(expense: ExpenseDto) {
    if (this.$hasActivePayments()) {
      this.#toast.show('Anula sus pagos primero', 'warning');
      return;
    }
    openCancelExpenseModal(this.#dialog, { expenseId: expense.id, description: expense.description }).subscribe((cancelled) => {
      if (cancelled) this.expense.reload();
    });
  }

  /** Abre el adjunto; si la URL temporal pudo vencer, pide una nueva (ventana abierta antes para evitar el bloqueo de pop-ups). */
  openDocument(expense: ExpenseDto) {
    if (!expense.documentUrl) return;
    if (Date.now() - this.#loadedAt < DOCUMENT_URL_TTL_MS) {
      window.open(expense.documentUrl, '_blank', 'noopener');
      return;
    }
    const tab = window.open('', '_blank');
    this.$isOpeningDocument.set(true);
    this.#expenses
      .get(expense.id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (fresh) => {
          this.$isOpeningDocument.set(false);
          this.#loadedAt = Date.now();
          this.expense.set({ ok: true, value: fresh });
          if (fresh.documentUrl && tab) {
            tab.opener = null;
            tab.location.href = fresh.documentUrl;
            return;
          }
          tab?.close();
          if (fresh.documentUrl) window.open(fresh.documentUrl, '_blank', 'noopener');
          else this.#toast.show('El gasto ya no tiene documento adjunto', 'warning');
        },
        error: (error: unknown) => {
          this.$isOpeningDocument.set(false);
          tab?.close();
          this.#toast.show(getFinanceErrorMessage(error, 'No se pudo abrir el documento'), 'error');
        },
      });
  }
}
