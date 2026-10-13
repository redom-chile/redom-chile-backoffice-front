import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, filter, map, Observable, of, switchMap } from 'rxjs';
import { SupportModeService } from 'src/app/core/services/support-mode';
import { readApiError } from 'src/app/core/utils/api-error';
import { ConfirmModalComponent, ConfirmModalData, ToastService } from 'src/ui';
import { getPlatformErrorMessage, PlatformService } from '../../data-access';

export type SupportAccessTarget = Readonly<{ grantId: number; businessId: number; businessName: string; expiresAt: string }>;

/** Acciones del SUPERADMIN sobre un acceso de soporte (#50), compartidas por el detalle del negocio y la lista. */
@Injectable({ providedIn: 'root' })
export class SupportAccessActionsService {
  readonly #platform = inject(PlatformService);
  readonly #support = inject(SupportModeService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);

  enter(target: SupportAccessTarget) {
    this.#support.enter({ grantId: target.grantId, businessId: target.businessId, businessName: target.businessName, expiresAt: target.expiresAt });
  }

  /** Confirma y termina el acceso. Emite true si hay que recargar (terminado o ya no existía). */
  end(target: SupportAccessTarget): Observable<boolean> {
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Terminar acceso de soporte',
          message: `Redom dejará de poder gestionar la carta de ${target.businessName}. El dueño recibirá un correo con el resumen de cambios.`,
          confirmText: 'Terminar acceso',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() =>
          this.#platform.endSupportAccess(target.grantId).pipe(
            map(() => {
              // Si estaba dentro de ese negocio, sale del modo soporte.
              if (this.#support.$session()?.grantId === target.grantId) this.#support.exit();
              this.#toast.show('Acceso terminado: el dueño recibirá un correo', 'success');
              return true;
            }),
            catchError((error: unknown) => {
              const notFound = readApiError(error).status === 404;
              this.#toast.show(getPlatformErrorMessage(error, 'No se pudo terminar el acceso'), notFound ? 'warning' : 'error');
              return of(notFound);
            }),
          ),
        ),
      );
  }
}
