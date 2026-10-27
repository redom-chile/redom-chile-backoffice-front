import { inject } from '@angular/core';
import { ToastService } from 'src/ui';

/** Copia un hash al portapapeles con aviso (llamar en contexto de inyección). */
export function copyLegalHash(): (hash: string | null | undefined) => void {
  const toast = inject(ToastService);
  return (hash) => {
    if (!hash) return;
    navigator.clipboard
      ?.writeText(hash)
      .then(() => toast.show('Hash copiado', 'success'))
      .catch(() => toast.show('No se pudo copiar el hash', 'error'));
  };
}
