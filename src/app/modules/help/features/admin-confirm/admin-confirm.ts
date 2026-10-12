import { MatDialog } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';
import { ConfirmModalComponent, ConfirmModalData } from 'src/ui';

/** Confirmación estándar de la administración del centro de ayuda. Emite true solo si se confirma. */
export function confirmHelpAction(dialog: MatDialog, data: ConfirmModalData): Observable<boolean> {
  return dialog
    .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { width: '440px', maxWidth: '95vw', data })
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
}
