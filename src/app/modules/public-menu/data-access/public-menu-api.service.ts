import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { PublicBusinessMenusDto, PublicLocationMenuDto, PublicTableDto } from './dtos';

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
}

/** El QR de una mesa: 32 caracteres hexadecimales (ningún slug tiene esa forma). */
export const TABLE_QR_PATTERN = /^[0-9a-f]{32}$/;
