import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { PublicSuggestionDto } from './dtos/menu-dynamic.dto';
import {
  CreateOnlineOrderDto,
  ReceiptUploadUrlDto,
  CreatePublicBookingDto,
  OrderFeedbackResultDto,
  PublicBookingDto,
  TableBillDto,
  TableRequestDto,
  TableRequestType,
} from './dtos';
import { CreatePublicOrderDto, PublicOrderDto, MenuEventsRequestDto, PublicBusinessMenusDto, PublicLocationMenuDto, PublicTableDto } from './dtos';

/**
 * Base de la API pública. La landing la provee con su propia URL (pasa por su proxy y Netlify, sin CORS);
 * en el backoffice se usa la de la app.
 */
export const PUBLIC_MENU_API_BASE = new InjectionToken<string>('PUBLIC_MENU_API_BASE', {
  providedIn: 'root',
  factory: () => `${ApiPathEnum.RESTAURANT}/public/v1`,
});

/** Carta pública: endpoints sin sesión. 404 MENU_NOT_FOUND, 301 MENU_MOVED (details.redirectTo), 429 RATE_LIMITED. */
@Injectable({ providedIn: 'root' })
export class PublicMenuApiService {
  readonly #http = inject(HttpClient);
  readonly #base = inject(PUBLIC_MENU_API_BASE);

  getBusinessMenus(businessSlug: string): Observable<PublicBusinessMenusDto> {
    return this.#http.get<PublicBusinessMenusDto>(`${this.#base}/menus/${encodeURIComponent(businessSlug)}`);
  }

  /** Con qr responde aunque la carta no esté publicada e incluye la mesa. */
  /** lang: etapa 7 (sin él, el backend usa el Accept-Language del navegador). */
  getLocationMenu(businessSlug: string, locationSlug: string, qr?: string | null, lang?: string | null): Observable<PublicLocationMenuDto> {
    const params: Record<string, string> = qr ? { qr } : {};
    if (lang) params['lang'] = lang;
    return this.#http.get<PublicLocationMenuDto>(
      `${this.#base}/menus/${encodeURIComponent(businessSlug)}/${encodeURIComponent(locationSlug)}`,
      { params },
    );
  }

  getTable(qrCode: string): Observable<PublicTableDto> {
    return this.#http.get<PublicTableDto>(`${this.#base}/tables/${encodeURIComponent(qrCode)}`);
  }

  /** URL de analítica (para navigator.sendBeacon al salir). */
  eventsUrl(): string {
    return `${this.#base}/events`;
  }

  /** Analítica por lotes (1 a 20). Ante cualquier error se descarta el lote: no se reintenta ni se muestra nada. */
  sendEvents(dto: MenuEventsRequestDto): Observable<void> {
    return this.#http.post<void>(`${this.#base}/events`, dto);
  }

  // --- Pedidos desde la mesa (etapa 3) ---

  /** 403 ORDERING_DISABLED, 409 LOCATION_CLOSED / TABLE_BLOCKED / PRODUCT_UNAVAILABLE, 400 PACK_CHOICES_INVALID / ORDER_TOO_LARGE, 429. */
  /** headers: etapa 10, X-Redom-Customer (customerHeaders). */
  createOrder(dto: CreatePublicOrderDto, headers?: HttpHeaders): Observable<PublicOrderDto> {
    return this.#http.post<PublicOrderDto>(`${this.#base}/orders`, dto, { headers });
  }

  getOrder(id: string): Observable<PublicOrderDto> {
    return this.#http.get<PublicOrderDto>(`${this.#base}/orders/${encodeURIComponent(id)}`);
  }

  /** Solo mientras está pending; 409 CUSTOMER_ORDER_NOT_PENDING si ya se resolvió. */
  cancelOrder(id: string): Observable<PublicOrderDto> {
    return this.#http.post<PublicOrderDto>(`${this.#base}/orders/${encodeURIComponent(id)}/cancel`, {});
  }

  // --- Servicio en la mesa, reservas y encuesta (etapa 4) ---

  /** Si ya hay una abierta del mismo tipo, devuelve esa. 403 TABLE_REQUESTS_DISABLED. */
  createTableRequest(qrCode: string, dto: { type: TableRequestType; note?: string }): Observable<TableRequestDto> {
    return this.#http.post<TableRequestDto>(`${this.#base}/tables/${encodeURIComponent(qrCode)}/requests`, dto);
  }

  /** Abiertas y atendidas en los últimos 15 minutos, la más nueva primero. */
  getTableRequests(qrCode: string): Observable<TableRequestDto[]> {
    return this.#http.get<TableRequestDto[]>(`${this.#base}/tables/${encodeURIComponent(qrCode)}/requests`);
  }

  getTableBill(qrCode: string): Observable<TableBillDto> {
    return this.#http.get<TableBillDto>(`${this.#base}/tables/${encodeURIComponent(qrCode)}/bill`);
  }

  /** 403 BOOKINGS_DISABLED, 400 BOOKING_INVALID_DATES / BOOKING_OUTSIDE_HOURS, 409 BOOKING_CONTACT_OVERLAP. */
  createBooking(dto: CreatePublicBookingDto): Observable<PublicBookingDto> {
    return this.#http.post<PublicBookingDto>(`${this.#base}/bookings`, dto);
  }

  /** 409 FEEDBACK_NOT_ALLOWED / FEEDBACK_ALREADY_SENT. */
  sendOrderFeedback(id: string, dto: { rating: number; comment?: string }): Observable<OrderFeedbackResultDto> {
    return this.#http.post<OrderFeedbackResultDto>(`${this.#base}/orders/${encodeURIComponent(id)}/feedback`, dto);
  }

  // --- Retiro y delivery (etapa 5) ---

  /** Sin qrCode. Errores: ORDERING_DISABLED, PAYMENT_METHOD_NOT_ACCEPTED, ORDER_SCHEDULE_INVALID, LOCATION_CLOSED,
   *  OUTSIDE_DELIVERY_AREA, BELOW_MINIMUM_ORDER, más los de la etapa 3. */
  createOnlineOrder(dto: CreateOnlineOrderDto, headers?: HttpHeaders): Observable<PublicOrderDto> {
    return this.#http.post<PublicOrderDto>(`${this.#base}/orders`, dto, { headers });
  }

  /** contentType imagen o PDF, ≤ 5 MB. Luego PUT uploadUrl con exactamente los headers recibidos. */
  createReceiptUploadUrl(id: string, dto: { contentType: string; sizeBytes: number; originalName?: string }): Observable<ReceiptUploadUrlDto> {
    return this.#http.post<ReceiptUploadUrlDto>(`${this.#base}/orders/${encodeURIComponent(id)}/receipt-upload-url`, dto);
  }

  /** → paymentStatus to_verify. 409 RECEIPT_NOT_ALLOWED. */
  confirmReceipt(id: string, fileId: string): Observable<PublicOrderDto> {
    return this.#http.post<PublicOrderDto>(`${this.#base}/orders/${encodeURIComponent(id)}/receipt/confirm`, { fileId });
  }

  /** Etapa 11: "Completa tu pedido". Sin reglas o sin plan: { suggestions: [] }. */
  getSuggestions(businessSlug: string, locationSlug: string, items: ReadonlyArray<{ productId: number; variationId: number }>): Observable<{ suggestions: PublicSuggestionDto[] }> {
    return this.#http.post<{ suggestions: PublicSuggestionDto[] }>(
      `${this.#base}/menus/${encodeURIComponent(businessSlug)}/${encodeURIComponent(locationSlug)}/suggestions`,
      { items },
    );
  }
}

/** El QR de una mesa: 32 caracteres hexadecimales (ningún slug tiene esa forma). */
export const TABLE_QR_PATTERN = /^[0-9a-f]{32}$/;
