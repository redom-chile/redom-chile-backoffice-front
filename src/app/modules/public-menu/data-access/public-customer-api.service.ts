import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  CUSTOMER_TOKEN_HEADER,
  CustomerLoyaltyDto,
  CustomerPreferencesDto,
  CustomerUsualDto,
  CustomerVerifyResultDto,
  OtpChannel,
  OtpRequestResultDto,
  PublicCustomerDto,
} from './dtos/customer-profiles.dto';
import { PUBLIC_MENU_API_BASE } from './public-menu-api.service';

type Place = Readonly<{ businessSlug: string; locationSlug: string }>;

/**
 * Etapa 10: perfil global del cliente, identificado por correo (header X-Redom-Customer). Errores: EMAIL_INVALID,
 * PHONE_INVALID, OTP_*, CONSENT_REQUIRED, CUSTOMER_TOKEN_INVALID (401), CUSTOMER_PROFILES_DISABLED (409, details.setting),
 * RATE_LIMITED (429 por IP).
 */
@Injectable({ providedIn: 'root' })
export class PublicCustomerApiService {
  readonly #http = inject(HttpClient);
  readonly #base = inject(PUBLIC_MENU_API_BASE);

  requestOtp(dto: Place & Readonly<{ email: string; language?: string; channel?: OtpChannel }>): Observable<OtpRequestResultDto> {
    return this.#http.post<OtpRequestResultDto>(`${this.#base}/customers/otp`, dto);
  }

  /** phone opcional y sin verificar: móvil chileno (con o sin +56) o internacional con +. */
  verify(dto: Place & Readonly<{ email: string; code: string; consent: true; name?: string; phone?: string }>): Observable<CustomerVerifyResultDto> {
    return this.#http.post<CustomerVerifyResultDto>(`${this.#base}/customers/verify`, dto);
  }

  me(token: string): Observable<PublicCustomerDto> {
    return this.#http.get<PublicCustomerDto>(`${this.#base}/customers/me`, { headers: auth(token) });
  }

  /** phone: null lo borra. preferences: solo cambian las claves enviadas. */
  updateMe(token: string, dto: Readonly<{ name?: string | null; phone?: string | null; preferences?: Partial<CustomerPreferencesDto> }>): Observable<PublicCustomerDto> {
    return this.#http.patch<PublicCustomerDto>(`${this.#base}/customers/me`, dto, { headers: auth(token) });
  }

  deleteMe(token: string): Observable<void> {
    return this.#http.delete<void>(`${this.#base}/customers/me`, { headers: auth(token) });
  }

  /** Cierra la sesión en todos los dispositivos. */
  logout(token: string): Observable<void> {
    return this.#http.post<void>(`${this.#base}/customers/logout`, {}, { headers: auth(token) });
  }

  usual(token: string, place: Place): Observable<CustomerUsualDto> {
    return this.#http.get<CustomerUsualDto>(`${this.#base}/customers/me/usual`, { headers: auth(token), params: { ...place } });
  }

  /** null (200 con cuerpo vacío): sin programa activo. */
  loyalty(token: string, place: Place): Observable<CustomerLoyaltyDto | null> {
    return this.#http
      .get<CustomerLoyaltyDto | null>(`${this.#base}/customers/me/loyalty`, { headers: auth(token), params: { ...place } })
      .pipe(map((loyalty) => (loyalty && typeof loyalty === 'object' && typeof loyalty.balance === 'number' ? loyalty : null)));
  }
}

/** Para enviar el pedido unido al cliente (POST /orders). */
export function customerHeaders(token: string | null | undefined): HttpHeaders | undefined {
  return token ? auth(token) : undefined;
}

function auth(token: string): HttpHeaders {
  return new HttpHeaders({ [CUSTOMER_TOKEN_HEADER]: token });
}
