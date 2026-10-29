import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, EMPTY, Observable, switchMap, throwError } from 'rxjs';
import { LegalApiService, legalDocumentsOf, LegalErrorCode, PendingDocumentDto } from 'src/app/core/services/legal';
import { readApiError } from 'src/app/core/utils/api-error';
import { openLegalCollectDialog } from 'src/app/modules/legal/features';
import { GoogleSessionDto } from '../dtos';
import { AuthService } from './auth.service';
import { GoogleRegistrationExpiredError } from './google-registration-expired.error';

/**
 * Login o registro con Google. Una cuenta nueva con documentos legales publicados responde 428 con los documentos y un
 * registrationToken: se muestran, y al aceptarlos se llama de nuevo (sin idToken) para crear la cuenta.
 * Completa sin emitir si la persona cancela.
 */
@Injectable({ providedIn: 'root' })
export class GoogleSignInService {
  readonly #auth = inject(AuthService);
  readonly #dialog = inject(MatDialog);
  readonly #legal = inject(LegalApiService);

  signIn(idToken: string): Observable<GoogleSessionDto> {
    return this.#auth.loginWithGoogle(idToken).pipe(
      catchError((error: unknown) => {
        const registrationToken = readApiError(error).details['registrationToken'];
        const documents = legalDocumentsOf(error);
        if (
          !(error instanceof HttpErrorResponse) ||
          error.status !== 428 ||
          typeof registrationToken !== 'string' ||
          !documents
        )
          return throwError(() => error);
        return this.#acceptAndRegister(registrationToken, documents);
      }),
    );
  }

  #acceptAndRegister(
    registrationToken: string,
    documents: readonly PendingDocumentDto[],
  ): Observable<GoogleSessionDto> {
    return openLegalCollectDialog(this.#dialog, {
      documents,
      title: 'Antes de crear tu cuenta',
      description: 'Para usar Redom, lee y acepta estos documentos.',
      confirmLabel: 'Aceptar y crear cuenta',
    }).pipe(
      switchMap((accepted) => (accepted ? this.#auth.completeGoogleRegistration(registrationToken, accepted) : EMPTY)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401)
          return throwError(() => new GoogleRegistrationExpiredError());
        // Cambió una versión mientras leía: se muestran de nuevo (el registrationToken sigue vigente).
        const again = legalDocumentsOf(error);
        if (again?.length) return this.#acceptAndRegister(registrationToken, again);
        if (readApiError(error).code === LegalErrorCode.VERSION_NOT_PUBLISHED)
          return this.#legal
            .currentDocuments(['platformTerms', 'privacyPolicy'])
            .pipe(
              switchMap((current) =>
                current.length ? this.#acceptAndRegister(registrationToken, current) : throwError(() => error),
              ),
            );
        return throwError(() => error);
      }),
    );
  }
}
