import { MatDialog } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';
import { ConfirmModalComponent, ConfirmModalData } from 'src/ui';

/** Confirmación estándar de los planes. Emite true solo si se confirma. */
export function confirmPlanAction(dialog: MatDialog, data: ConfirmModalData): Observable<boolean> {
  return dialog
    .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { width: '440px', maxWidth: '95vw', data })
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
}

/** "Afecta al instante a los N negocios del plan" (funciones y límites). */
export function planImpactMessage(subscriptions: number): string {
  if (subscriptions <= 0) return 'El plan no tiene negocios todavía; el cambio aplicará a los que lo contraten.';
  return subscriptions === 1
    ? 'Afecta al instante al negocio que tiene este plan.'
    : `Afecta al instante a los ${subscriptions} negocios del plan.`;
}
