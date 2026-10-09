import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  CheckoutRequestDto,
  CheckoutResultDto,
  InvoiceWithPaymentsDto,
  ManualPaymentRequestDto,
  OwnerPlanDto,
  OwnerSubscriptionDto,
} from './dtos';

const BASE = ApiPathEnum.BILLING;

/** Suscripción del negocio: solo el dueño (o SUPERADMIN). Otros usuarios: 403 BILLING_OWNER_REQUIRED. */
@Injectable({ providedIn: 'root' })
export class BillingService {
  readonly #http = inject(HttpClient);

  getSubscription(): Observable<OwnerSubscriptionDto> {
    return this.#http.get<OwnerSubscriptionDto>(`${BASE}/subscription`);
  }

  getPlans(): Observable<OwnerPlanDto[]> {
    return this.#http.get<OwnerPlanDto[]>(`${BASE}/plans`);
  }

  /**
   * 404 PLAN_PRICE_NOT_FOUND, 400 DISCOUNT_*, 409 PLAN_DOWNGRADE_OVER_LIMIT ({ limit, used, max }),
   * 409 PAYMENT_PENDING_REVIEW, 400 si el plan es free (para eso se cancela).
   */
  checkout(dto: CheckoutRequestDto): Observable<CheckoutResultDto> {
    return this.#http.post<CheckoutResultDto>(`${BASE}/checkout`, dto);
  }

  /** Cupón para los próximos cobros (reemplaza el actual). */
  applyCoupon(code: string): Observable<OwnerSubscriptionDto> {
    return this.#http.post<OwnerSubscriptionDto>(`${BASE}/coupon`, { code });
  }

  /** Al terminar el período (o la prueba) pasa a Free sin perder datos. */
  cancel(): Observable<OwnerSubscriptionDto> {
    return this.#http.post<OwnerSubscriptionDto>(`${BASE}/cancel`, {});
  }

  resume(): Observable<OwnerSubscriptionDto> {
    return this.#http.post<OwnerSubscriptionDto>(`${BASE}/resume`, {});
  }

  getInvoices(page = 1, perPage = 10): Observable<StandardizedPagination<InvoiceWithPaymentsDto>> {
    return this.#http.get<StandardizedPagination<InvoiceWithPaymentsDto>>(`${BASE}/invoices`, { params: toHttpParams({ page, perPage }) });
  }

  /** 409 INVOICE_NOT_PAYABLE; 400 si el monto supera lo que falta (contando lo que está en revisión). */
  reportTransfer(invoiceId: number, dto: ManualPaymentRequestDto): Observable<InvoiceWithPaymentsDto> {
    return this.#http.post<InvoiceWithPaymentsDto>(`${BASE}/invoices/${invoiceId}/manual-payment`, dto);
  }
}
