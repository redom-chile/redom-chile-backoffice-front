import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
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
  getLocationMenu(businessSlug: string, locationSlug: string, qr?: string | null): Observable<PublicLocationMenuDto> {
    const params: Record<string, string> = qr ? { qr } : {};
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
  createOrder(dto: CreatePublicOrderDto): Observable<PublicOrderDto> {
    return this.#http.post<PublicOrderDto>(`${this.#base}/orders`, dto);
  }

  getOrder(id: string): Observable<PublicOrderDto> {
    return this.#http.get<PublicOrderDto>(`${this.#base}/orders/${encodeURIComponent(id)}`);
  }

  /** Solo mientras está pending; 409 CUSTOMER_ORDER_NOT_PENDING si ya se resolvió. */
  cancelOrder(id: string): Observable<PublicOrderDto> {
    return this.#http.post<PublicOrderDto>(`${this.#base}/orders/${encodeURIComponent(id)}/cancel`, {});
  }
}

/** El QR de una mesa: 32 caracteres hexadecimales (ningún slug tiene esa forma). */
export const TABLE_QR_PATTERN = /^[0-9a-f]{32}$/;
