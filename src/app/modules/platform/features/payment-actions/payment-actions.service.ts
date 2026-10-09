import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/billing/data-access';
import { ConfirmModalComponent, ConfirmModalData, ToastService } from 'src/ui';
import { formatClp, getPlatformErrorMessage, PlatformInvoiceDto, PlatformService } from '../../data-access';
import { openInvoicePaymentModal } from '../invoice-payment-modal';
import { openPaymentExportModal } from '../payment-export-modal';
import { openPaymentReasonModal } from '../payment-reason-modal';
import { PaymentReviewCountService } from '../payment-review-count';
import { InvoiceTarget, PaymentTarget } from '../payment-shared';

/**
 * Acciones del superadmin sobre cobros y pagos, compartidas por "Pagos por revisar", "Cobros" y el detalle
 * del negocio. Cada una emite true si cambió algo (hay que recargar) y false si se canceló o falló.
 */
@Injectable({ providedIn: 'root' })
export class PaymentActionsService {
  readonly #dialog = inject(MatDialog);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #reviewCount = inject(PaymentReviewCountService);

  confirm(payment: PaymentTarget): Observable<boolean> {
    const reference = payment.reference ? ` (ref. ${payment.reference})` : '';
    const data: ConfirmModalData = {
      title: 'Confirmar pago',
      message:
        `¿Recibiste la ${PAYMENT_METHOD_LABELS[payment.method].toLowerCase()} de ${formatClp(payment.amount)} de ${payment.businessName}${reference}? ` +
        'Si cubre el total, el cobro queda pagado y la suscripción activa.',
      confirmText: 'Confirmar',
    };
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { width: '440px', maxWidth: '95vw', data })
      .afterClosed()
      .pipe(
        switchMap((confirmed) => {
          if (confirmed !== true) return of(false);
          return this.#platform.confirmPayment(payment.id).pipe(
            tap((result) => this.#toast.show(confirmMessage(result as Partial<PlatformInvoiceDto> | null), 'success')),
            map(() => true),
            catchError((error: unknown) => {
              this.#toast.show(getPlatformErrorMessage(error, 'No se pudo confirmar el pago'), 'error');
              // 409: ya fue revisado por otro; hay que recargar igual.
              return of(readApiError(error).status === 409);
            }),
          );
        }),
        tap((changed) => changed && this.#reviewCount.refresh()),
      );
  }

  reject(payment: PaymentTarget): Observable<boolean> {
    return this.#afterSave(openPaymentReasonModal(this.#dialog, { mode: 'reject', payment }));
  }

  reverse(payment: PaymentTarget): Observable<boolean> {
    return this.#afterSave(openPaymentReasonModal(this.#dialog, { mode: 'reverse', payment }));
  }

  register(invoice: InvoiceTarget): Observable<boolean> {
    return this.#afterSave(openInvoicePaymentModal(this.#dialog, { invoice }));
  }

  exportPayments(): Observable<boolean> {
    return openPaymentExportModal(this.#dialog).pipe(map((done) => done === true));
  }

  #afterSave(closed: Observable<boolean | undefined>): Observable<boolean> {
    return closed.pipe(
      map((saved) => saved === true),
      tap((saved) => saved && this.#reviewCount.refresh()),
    );
  }
}

function confirmMessage(invoice: Partial<PlatformInvoiceDto> | null): string {
  if (invoice?.status === 'paid') {
    return invoice.kind === 'proration' ? 'Pago confirmado: el prorrateo quedó pagado' : 'Pago confirmado: la suscripción quedó activa';
  }
  if (invoice?.total !== undefined && invoice.paidAmount !== undefined) {
    return `Pago confirmado. Falta ${formatClp(Math.max(0, invoice.total - invoice.paidAmount))} para completar el cobro`;
  }
  return 'Pago confirmado';
}
