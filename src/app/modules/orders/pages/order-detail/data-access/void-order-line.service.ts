import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { VoidOrderLineRequestDto, VoidOrderLineResultDto, VoidReason } from './dtos/order-detail.dto';

/** Motivos en el orden en que se muestran (backend: VOID_REASONS). */
export const VOID_REASON_LABELS: ReadonlyArray<Readonly<{ value: VoidReason; label: string }>> = [
  { value: 'order_error', label: 'Error al tomar el pedido' },
  { value: 'customer_changed', label: 'El cliente cambió de opinión' },
  { value: 'out_of_stock', label: 'Agotado' },
  { value: 'took_too_long', label: 'Demoró mucho' },
  { value: 'other', label: 'Otro' },
];

export function voidReasonLabel(reason: VoidReason): string {
  return VOID_REASON_LABELS.find((item) => item.value === reason)?.label ?? reason;
}

/** Anular unidades de un producto de una cuenta abierta (C46). */
@Injectable({ providedIn: 'root' })
export class VoidOrderLineService {
  readonly #http = inject(HttpClient);

  voidLine(orderId: number, lineId: number, body: VoidOrderLineRequestDto): Observable<VoidOrderLineResultDto> {
    return this.#http.post<VoidOrderLineResultDto>(
      `${ApiPathEnum.RESTAURANT}/orders/${orderId}/lines/${lineId}/void`,
      body,
    );
  }
}
