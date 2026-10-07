import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanDeactivateFn } from '@angular/router';
import { map } from 'rxjs';
import { ConfirmModalComponent, ConfirmModalData } from 'src/ui';

/** Página con datos que se pierden al salir sin guardar (editor de recetas, hoja de conteo). */
export type HasUnsavedChanges = { hasUnsavedChanges(): boolean };

/** Pide confirmación antes de salir navegando dentro de la app; cerrar o recargar lo cubre beforeunload. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) return true;
  return inject(MatDialog)
    .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      width: '440px',
      maxWidth: '95vw',
      data: {
        title: 'Hay cambios sin guardar',
        message: 'Si sales ahora, se perderá lo que ingresaste y no está guardado.',
        confirmText: 'Salir sin guardar',
        cancelText: 'Seguir editando',
        tone: 'danger',
      },
    })
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
};

