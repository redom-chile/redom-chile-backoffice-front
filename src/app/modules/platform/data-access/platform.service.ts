import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import { PlanLimitCode } from 'src/app/core/services/entitlements';
import {
  PlatformInvoiceDto,
  PlatformInvoiceFiltersDto,
  RegisterPaymentDto,
  CreateOverrideDto,
  DiscountDto,
  DiscountFiltersDto,
  OverrideDto,
  PlanInterval,
  PlatformBusinessDetailDto,
  PlatformBusinessFiltersDto,
  PlatformBusinessItemDto,
  PlatformFeatureDto,
  PlatformPlanDto,
  PlatformSettingsDto,
  PlatformSummaryDto,
  SaveDiscountDto,
  SavePlanDto,
  SubscriptionDetailDto,
  UpdatePlatformSettingsDto,
  UpdateSubscriptionDto,
} from './dtos';

const BASE = `${ApiPathEnum.BILLING}/platform`;

/** Panel del superadmin: todo /platform/* responde 403 a otros usuarios y queda auditado. */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly #http = inject(HttpClient);

  getSummary(): Observable<PlatformSummaryDto> {
    return this.#http.get<PlatformSummaryDto>(`${BASE}/summary`);
  }

  // --- Planes ---
  getPlans(): Observable<PlatformPlanDto[]> {
    return this.#http.get<PlatformPlanDto[]>(`${BASE}/plans`);
  }

  /** 409 PLAN_CODE_TAKEN. */
  createPlan(dto: SavePlanDto): Observable<PlatformPlanDto> {
    return this.#http.post<PlatformPlanDto>(`${BASE}/plans`, dto);
  }

  /** Sin `code`. Desactivar: 409 PLAN_HAS_SUBSCRIPTIONS o PLAN_REQUIRED_BY_SETTINGS. */
  updatePlan(id: number, dto: Omit<SavePlanDto, 'code'>): Observable<PlatformPlanDto> {
    return this.#http.put<PlatformPlanDto>(`${BASE}/plans/${id}`, dto);
  }

  /** Los que no se envían quedan después. */
  reorderPlans(ids: number[]): Observable<PlatformPlanDto[]> {
    return this.#http.patch<PlatformPlanDto[]>(`${BASE}/plans/reorder`, { ids });
  }

  /** Reemplaza todas; afecta al instante a los negocios del plan. */
  setPlanFeatures(id: number, featureCodes: string[]): Observable<PlatformPlanDto> {
    return this.#http.put<PlatformPlanDto>(`${BASE}/plans/${id}/features`, { featureCodes });
  }

  /** Solo cambian los enviados; null = ilimitado. */
  setPlanLimits(id: number, limits: Partial<Record<PlanLimitCode, number | null>>): Observable<PlatformPlanDto> {
    return this.#http.put<PlatformPlanDto>(`${BASE}/plans/${id}/limits`, { limits });
  }

  /** Nuevo precio vigente: el anterior queda en el historial y las suscripciones actuales mantienen el suyo. */
  createPlanPrice(id: number, dto: { interval: PlanInterval; amount: number }): Observable<PlatformPlanDto> {
    return this.#http.post<PlatformPlanDto>(`${BASE}/plans/${id}/prices`, dto);
  }

  getFeatures(): Observable<PlatformFeatureDto[]> {
    return this.#http.get<PlatformFeatureDto[]>(`${BASE}/features`);
  }

  // --- Descuentos (sin DELETE: se desactivan) ---
  getDiscounts(filters: DiscountFiltersDto): Observable<StandardizedPagination<DiscountDto>> {
    return this.#http.get<StandardizedPagination<DiscountDto>>(`${BASE}/discounts`, { params: toHttpParams(filters) });
  }

  createDiscount(dto: SaveDiscountDto): Observable<DiscountDto> {
    return this.#http.post<DiscountDto>(`${BASE}/discounts`, dto);
  }

  updateDiscount(id: number, dto: SaveDiscountDto): Observable<DiscountDto> {
    return this.#http.put<DiscountDto>(`${BASE}/discounts/${id}`, dto);
  }

  // --- Ajustes ---
  getSettings(): Observable<PlatformSettingsDto> {
    return this.#http.get<PlatformSettingsDto>(`${BASE}/settings`);
  }

  updateSettings(dto: UpdatePlatformSettingsDto): Observable<PlatformSettingsDto> {
    return this.#http.patch<PlatformSettingsDto>(`${BASE}/settings`, dto);
  }

  // --- Negocios ---
  getBusinesses(filters: PlatformBusinessFiltersDto): Observable<StandardizedPagination<PlatformBusinessItemDto>> {
    return this.#http.get<StandardizedPagination<PlatformBusinessItemDto>>(`${BASE}/businesses`, { params: toHttpParams(filters) });
  }

  /** Lectura auditada. */
  getBusiness(id: number): Observable<PlatformBusinessDetailDto> {
    return this.#http.get<PlatformBusinessDetailDto>(`${BASE}/businesses/${id}`);
  }

  updateSubscription(businessId: number, dto: UpdateSubscriptionDto): Observable<SubscriptionDetailDto> {
    return this.#http.patch<SubscriptionDetailDto>(`${BASE}/businesses/${businessId}/subscription`, dto);
  }

  /** 400 DISCOUNT_INVALID / DISCOUNT_EXPIRED / DISCOUNT_NOT_APPLICABLE. */
  assignDiscount(businessId: number, discountId: number): Observable<SubscriptionDetailDto> {
    return this.#http.post<SubscriptionDetailDto>(`${BASE}/businesses/${businessId}/discount`, { discountId });
  }

  removeDiscount(businessId: number): Observable<SubscriptionDetailDto> {
    return this.#http.delete<SubscriptionDetailDto>(`${BASE}/businesses/${businessId}/discount`);
  }

  createOverride(businessId: number, dto: CreateOverrideDto): Observable<OverrideDto> {
    return this.#http.post<OverrideDto>(`${BASE}/businesses/${businessId}/overrides`, dto);
  }

  /** Termina la excepción ahora (queda en el historial). */
  endOverride(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/overrides/${id}`);
  }

  // --- Cobros y pagos ---
  getInvoices(filters: PlatformInvoiceFiltersDto): Observable<StandardizedPagination<PlatformInvoiceDto>> {
    return this.#http.get<StandardizedPagination<PlatformInvoiceDto>>(`${BASE}/invoices`, { params: toHttpParams(filters) });
  }

  /** Pago recibido por otro medio, ya confirmado. 409 INVOICE_NOT_PAYABLE si está pagado o anulado. */
  registerPayment(invoiceId: number, dto: RegisterPaymentDto): Observable<PlatformInvoiceDto> {
    return this.#http.post<PlatformInvoiceDto>(`${BASE}/invoices/${invoiceId}/payments`, dto);
  }

  /** 409 PAYMENT_ALREADY_CONFIRMED si ya fue revisado. */
  confirmPayment(id: number): Observable<PlatformInvoiceDto> {
    return this.#http.patch<PlatformInvoiceDto>(`${BASE}/payments/${id}/confirm`, {});
  }

  rejectPayment(id: number, reason: string): Observable<PlatformInvoiceDto> {
    return this.#http.patch<PlatformInvoiceDto>(`${BASE}/payments/${id}/reject`, { reason });
  }

  /** Crea el reverso (el cobro vuelve a pendiente; si era el período actual, la suscripción pasa a past_due). */
  reversePayment(id: number, reason: string): Observable<PlatformInvoiceDto> {
    return this.#http.post<PlatformInvoiceDto>(`${BASE}/payments/${id}/reverse`, { reason });
  }

  /** CSV (UTF-8 con BOM) de pagos y reversos; por defecto el mes actual, máx. 366 días. Va con Bearer (interceptor). */
  exportPayments(range: { from?: string; to?: string }): Observable<Blob> {
    return this.#http.get(`${BASE}/payments/export`, { params: toHttpParams(range), responseType: 'blob' });
  }
}
