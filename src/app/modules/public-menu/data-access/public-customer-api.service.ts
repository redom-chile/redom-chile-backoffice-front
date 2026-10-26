import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { LegalMeDto } from 'src/app/core/services/legal/dtos';
import {
  AcceptCustomerLegalDto,
  CUSTOMER_TOKEN_HEADER,
  CustomerLoyaltyDto,
  CustomerPreferencesDto,
  CustomerUsualDto,
  CustomerVerifyResultDto,
  OtpChannel,
  OtpRequestResultDto,
  PublicCustomerDto,
  PublicCustomerMeDto,
  WithdrawCustomerLegalDto,
} from './dtos/customer-profiles.dto';
import { PUBLIC_MENU_API_BASE } from './public-menu-api.service';

type Place = Readonly<{ businessSlug: string; locationSlug: string }>;

/**
 * Etapa 10: perfil global del cliente, identificado por correo (header X-Redom-Customer). Errores: EMAIL_INVALID,
 * PHONE_INVALID, OTP_*, LEGAL_ACCEPTANCE_REQUIRED (400 al pedir o verificar el código; 428 en usual, loyalty y pedidos con
 * pendientes, con details.documents), CUSTOMER_TOKEN_INVALID (401), CUSTOMER_PROFILES_DISABLED (409, details.setting),
 * RATE_LIMITED (429 por IP).
 */
@Injectable({ providedIn: 'root' })
export class PublicCustomerApiService {
  readonly #http = inject(HttpClient);
  readonly #base = inject(PUBLIC_MENU_API_BASE);

  /** acceptedVersionIds: versiones vigentes de dinerTerms, privacyPolicy y dinerDataConsent (y marketingConsent si se marcó). */
  requestOtp(
    dto: Place & Readonly<{ email: string; language?: string; channel?: OtpChannel; acceptedVersionIds?: number[] }>,
  ): Observable<OtpRequestResultDto> {
    return this.#http.post<OtpRequestResultDto>(`${this.#base}/customers/otp`, dto);
  }

  /**
   * phone opcional y sin verificar: móvil chileno (con o sin +56) o internacional con +. Registra las versiones enviadas al
   * pedir el código; acceptedVersionIds solo si hubo que volver a aceptar.
   */
  verify(
    dto: Place & Readonly<{ email: string; code: string; acceptedVersionIds?: number[]; name?: string; phone?: string }>,
  ): Observable<CustomerVerifyResultDto> {
    return this.#http.post<CustomerVerifyResultDto>(`${this.#base}/customers/verify`, dto);
  }

  me(token: string): Observable<PublicCustomerMeDto> {
    return this.#http.get<PublicCustomerMeDto>(`${this.#base}/customers/me`, { headers: auth(token) });
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

  /** Acepta versiones vigentes (pendientes, o marketingConsent del negocio con businessSlug). 400 LEGAL_VERSION_NOT_PUBLISHED. */
  acceptLegal(token: string, dto: AcceptCustomerLegalDto): Observable<LegalMeDto> {
    return this.#http.post<LegalMeDto>(`${this.#base}/customers/legal/accept`, dto, { headers: auth(token) });
  }

  /** Retira un consentimiento opcional (marketingConsent del negocio). Un documento obligatorio: 400 LEGAL_DOCUMENT_INVALID. */
  withdrawLegal(token: string, dto: WithdrawCustomerLegalDto): Observable<LegalMeDto> {
    return this.#http.post<LegalMeDto>(`${this.#base}/customers/legal/withdraw`, dto, { headers: auth(token) });
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
