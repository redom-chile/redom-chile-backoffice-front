import { MatDialog } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';
import { ConfirmModalComponent, ConfirmModalData } from 'src/ui';
import { formatPlatformDate, LegalDocumentDto } from '../../data-access';

type PublishTarget = Readonly<{ version: number; language: string; isMaterialChange: boolean; effectiveAt: string | null }>;

function confirm(dialog: MatDialog, data: ConfirmModalData): Observable<boolean> {
  return dialog
    .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { width: '480px', maxWidth: '95vw', data })
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
}

/** Confirma publicar (ahora o programada): explica que no cambia más y si se vuelve a pedir la aceptación. */
export function confirmLegalPublish(dialog: MatDialog, document: LegalDocumentDto, target: PublishTarget): Observable<boolean> {
  const scheduled = !!target.effectiveAt && Date.parse(target.effectiveAt) > Date.now();
  const when = scheduled ? `Entrará en vigencia el ${formatPlatformDate(target.effectiveAt, true)} (hora de Chile).` : 'Entrará en vigencia ahora.';
  const effect = !document.isRequired
    ? 'El documento es opcional: nadie queda obligado a aceptarlo.'
    : target.isMaterialChange
      ? 'Es un cambio material: quienes aceptaron una versión anterior deberán aceptar de nuevo para seguir usando Redom.'
      : 'No es un cambio material: solo se informa y las aceptaciones anteriores siguen valiendo.';
  return confirm(dialog, {
    title: scheduled ? `Programar la versión ${target.version}` : `Publicar la versión ${target.version}`,
    message: `${when} ${effect} Una vez publicada, su contenido y su PDF no se pueden cambiar (se guarda su hash): para corregir, crea otra versión.`,
    confirmText: scheduled ? 'Programar' : 'Publicar ahora',
    cancelText: 'Volver',
    tone: 'primary',
  });
}

export function confirmLegalRetire(dialog: MatDialog, version: number, scheduled = false): Observable<boolean> {
  return confirm(dialog, {
    title: `Retirar la versión ${version}`,
    message: scheduled
      ? 'Ya no entrará en vigencia y sigue rigiendo la versión actual. No se puede volver a publicar: para reemplazarla, crea otra versión.'
      : 'Deja de estar vigente y vuelve a regir la versión publicada anterior (si existe). Las aceptaciones registradas se mantienen.',
    confirmText: 'Retirar',
    cancelText: 'Volver',
    tone: 'danger',
  });
}
