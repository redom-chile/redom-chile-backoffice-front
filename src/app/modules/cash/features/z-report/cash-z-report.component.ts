import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { formatDateTimeFull } from 'src/app/modules/inventory/shared';
import { formatCurrency, formatDateTime } from 'src/app/modules/orders/pages/order-list/ui';
import { printHtml } from 'src/app/shared/utils/printing/browser-print';
import { ButtonComponent, IconComponent, ToastService } from 'src/ui';
import {
  CASH_MOVEMENT_LABELS,
  CashMethodSummaryDto,
  CashMovementDto,
  cashMovementSign,
  CashSessionDto,
  PAYMENT_METHOD_LABELS,
} from '../../data-access';
import { CashDifferenceComponent, DIFFERENCE_CLASSES, differenceTone, formatTime } from '../../ui';
import { zReportHtml } from './z-report-print';

type TotalCard = Readonly<{ label: string; value: number; count?: number; tone?: 'plus' | 'minus' }>;

/**
 * Reporte Z de un turno: cabecera (opcional), totales, resumen por medio, efectivo y movimientos.
 * Con detailVisible false (turno abierto y no es el dueño) solo muestra la cabecera y el aviso.
 */
@Component({
  selector: 'app-cash-z-report',
  imports: [NgTemplateOutlet, RouterLink, ButtonComponent, IconComponent, CashDifferenceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-z-report.component.html',
})
export class CashZReportComponent {
  readonly #toast = inject(ToastService);

  readonly session = input.required<CashSessionDto>();
  readonly showHeader = input(true);
  readonly showPrint = input(true);

  readonly formatCurrency = formatCurrency;
  readonly formatDateTimeFull = formatDateTimeFull;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly movementLabels = CASH_MOVEMENT_LABELS;

  readonly $isPrinting = signal(false);
  readonly $expandedMethod = signal<string | null>(null);

  readonly $isOpen = computed(() => this.session().status === 'open');
  readonly $showDetail = computed(() => this.session().detailVisible && !!this.session().totals);

  readonly $cards = computed<TotalCard[]>(() => {
    const totals = this.session().totals;
    if (!totals) return [];
    const cards: TotalCard[] = [
      { label: 'Fondo inicial', value: totals.openingAmount },
      { label: 'Ventas', value: totals.sales, count: totals.salesCount, tone: 'plus' },
      { label: 'Propinas', value: totals.tips },
      { label: 'Devoluciones', value: totals.refunds, count: totals.refundsCount, tone: 'minus' },
      { label: 'Ingresos', value: totals.cashIn, tone: 'plus' },
      { label: 'Retiros', value: totals.cashOut, tone: 'minus' },
    ];
    // Pagos de gastos y compras en efectivo, y sus anulaciones (devuelven el efectivo).
    if (totals.expenses > 0) cards.push({ label: 'Gastos pagados', value: totals.expenses, tone: 'minus' });
    if ((totals.expenseRefunds ?? 0) > 0) cards.push({ label: 'Anulaciones de gastos', value: totals.expenseRefunds ?? 0, tone: 'plus' });
    // Propinas pagadas al equipo desde la caja, y sus anulaciones.
    if ((totals.tipPayouts ?? 0) > 0) cards.push({ label: 'Propinas pagadas', value: totals.tipPayouts ?? 0, tone: 'minus' });
    if ((totals.tipPayoutRefunds ?? 0) > 0) cards.push({ label: 'Anulaciones de propinas', value: totals.tipPayoutRefunds ?? 0, tone: 'plus' });
    return cards;
  });

  readonly $methods = computed(() => this.session().methods ?? []);
  readonly $movements = computed(() => this.session().movements ?? []);
  readonly $cashDifferenceClass = computed(() => DIFFERENCE_CLASSES[differenceTone(this.session().cashDifference)]);

  // Si el turno pasa de un día, la hora sola no basta.
  readonly #isMultiDay = computed(() => {
    const { openedAt, closedAt } = this.session();
    return new Date(openedAt).toDateString() !== new Date(closedAt ?? Date.now()).toDateString();
  });

  movementTime(movement: CashMovementDto): string {
    return this.#isMultiDay() ? formatDateTime(movement.createdAt) : formatTime(movement.createdAt);
  }

  isNegative(movement: CashMovementDto): boolean {
    return cashMovementSign(movement.type) < 0;
  }

  hasDenominations(method: CashMethodSummaryDto): boolean {
    return (method.denominations ?? []).some((denomination) => denomination.quantity > 0);
  }

  toggleMethod(method: string) {
    this.$expandedMethod.update((current) => (current === method ? null : method));
  }

  async print() {
    if (this.$isPrinting()) return;
    this.$isPrinting.set(true);
    try {
      await printHtml(zReportHtml(this.session()), 80);
    } catch {
      this.#toast.show('No se pudo abrir la impresión', 'error');
    } finally {
      this.$isPrinting.set(false);
    }
  }
}
