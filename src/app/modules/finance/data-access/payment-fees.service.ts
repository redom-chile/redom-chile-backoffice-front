import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import { PaymentMethod, PaymentMethodSettingDto, SettlementFiltersDto, SettlementsDto, UpdatePaymentMethodSettingDto } from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/payments`;

/** Comisiones de cada medio de pago y plata por llegar al banco (estimada). */
@Injectable({ providedIn: 'root' })
export class PaymentFeesService {
  readonly #http = inject(HttpClient);

  /** Uno por medio (cash, debit, credit, transfer, other); sin configurar: 0 % y el mismo día. */
  settings(): Observable<PaymentMethodSettingDto[]> {
    return this.#http.get<PaymentMethodSettingDto[]>(`${BASE}/method-settings`);
  }

  /** Solo cambia lo enviado. */
  updateSetting(method: PaymentMethod, dto: UpdatePaymentMethodSettingDto): Observable<PaymentMethodSettingDto> {
    return this.#http.put<PaymentMethodSettingDto>(`${BASE}/method-settings/${method}`, dto);
  }

  /** Sin efectivo ni pagos anulados. */
  settlements(filters: SettlementFiltersDto = {}): Observable<SettlementsDto> {
    return this.#http.get<SettlementsDto>(`${BASE}/settlements`, { params: toHttpParams(filters) });
  }
}
