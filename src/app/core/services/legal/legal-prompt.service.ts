import { effect, inject, Injectable, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { finalize, map, Observable, shareReplay, tap } from 'rxjs';
import { openLegalAcceptanceDialog } from 'src/app/modules/legal/features';
import { WhoamiService } from '../whoami/whoami.service';
import { PendingDocumentDto } from './dtos';
import { LegalSessionStore } from './legal-session.store';

/**
 * Modal bloqueante de documentos pendientes (sesión normal). Uno solo a la vez: los 428 que lleguen mientras está
 * abierto esperan el mismo resultado. También se abre solo cuando whoami trae `legal.pending`.
 */
@Injectable({ providedIn: 'root' })
export class LegalPromptService {
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  readonly #whoami = inject(WhoamiService);
  readonly #store = inject(LegalSessionStore);
  #open$: Observable<boolean> | null = null;

  constructor() {
    effect(() => {
      const pending = (this.#whoami.$whoami()?.legal?.pending ?? []).filter((document) => document.isRequired);
      if (!pending.length || this.#store.$restricted()) return;
      untracked(() => {
        // La página pública del documento ya ofrece aceptarlo.
        if (this.#router.url.startsWith('/legal')) return;
        this.require(pending).subscribe();
      });
    });
  }

  /** true cuando aceptó todo (se puede reintentar lo que falló); false si cerró sesión. */
  require(documents: readonly PendingDocumentDto[]): Observable<boolean> {
    if (this.#open$) return this.#open$;
    this.#open$ = openLegalAcceptanceDialog(this.#dialog, { documents })
      .afterClosed()
      .pipe(
        map((accepted) => accepted === true),
        tap((accepted) => accepted && this.#whoami.refetch()),
        finalize(() => (this.#open$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.#open$;
  }
}
