import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ApiError, ApiErrorCode } from 'src/app/core/utils/api-error';
import { ToastService } from 'src/ui';
import { CashDeviceStore, CashService } from '../../data-access';
import { openCashSessionModal } from '../open-session-modal';
import { openRegisterPicker } from '../cash-panel/register-picker-modal/register-picker-modal.component';

export type CashRetryContext = Readonly<{
  // Local del gasto, compra o pago.
  locationId: number | null;
  // Caja que se envió (si se envió).
  cashRegisterId?: number | null;
  // Para qué se pide la caja: "Para pagar este gasto en efectivo…".
  purpose: string;
}>;

/**
 * Resuelve los errores de caja de un pago en efectivo (gastos, cuentas por pagar, compras):
 * - CASH_SESSION_REQUIRED → abre el modal "Abrir caja" y devuelve la caja abierta para reintentar;
 * - CASH_REGISTER_AMBIGUOUS → deja elegir la caja (y la recuerda en este equipo).
 * Emite el id de caja para reintentar, null si el usuario canceló, o undefined si el error no es de caja.
 */
@Injectable({ providedIn: 'root' })
export class CashRetryService {
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #cash = inject(CashService);
  readonly #device = inject(CashDeviceStore);
  readonly #settings = inject(BusinessSettingsService);

  /** Caja de este equipo para el local (solo con el módulo activo). */
  deviceRegister(locationId: number | null | undefined): number | undefined {
    if (!this.#settings.$cashManagementEnabled()) return undefined;
    return this.#device.registerFor(locationId) ?? undefined;
  }

  resolve(error: ApiError, context: CashRetryContext): Observable<number | null | undefined> {
    if (error.code === ApiErrorCode.CASH_SESSION_REQUIRED) {
      const registerId = Number(error.details['registerId']) || context.cashRegisterId || null;
      this.#toast.show('La caja está cerrada: ábrela para continuar', 'warning');
      return openCashSessionModal(this.#dialog, {
        locationId: context.locationId,
        registerId,
        message: context.purpose,
      }).pipe(map((opened) => opened?.registerId ?? null));
    }

    if (error.code === ApiErrorCode.CASH_REGISTER_AMBIGUOUS) {
      const ids = Array.isArray(error.details['registerIds']) ? (error.details['registerIds'] as unknown[]).map(Number) : [];
      const locationId = context.locationId;
      return this.#cash.getRegisters(locationId ? { locationId } : {}).pipe(
        switchMap((registers) =>
          openRegisterPicker(this.#dialog, {
            title: '¿De qué caja sale el efectivo?',
            message: 'Hay varias cajas abiertas en este local. Este equipo recordará la que elijas.',
            registers: registers.filter((register) => ids.includes(register.id) || (!ids.length && register.openSession)),
          }),
        ),
        map((registerId) => {
          if (!registerId) return null;
          if (locationId) this.#device.select(locationId, registerId);
          return registerId;
        }),
        catchError(() => {
          this.#toast.show('Hay varias cajas abiertas y no se pudieron cargar. Intenta nuevamente.', 'error');
          return of(null);
        }),
      );
    }

    // La caja guardada ya no sirve (borrada, desactivada o de otro local): se olvida.
    if (context.cashRegisterId && context.locationId && /cash register (not found|is inactive)|belongs to another location/i.test(error.message)) {
      this.#device.select(context.locationId, null);
    }
    return of(undefined);
  }
}
