import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { LegalDocumentCode, LegalMeDto, LegalVersionDto, PendingDocumentDto } from './dtos';

/** Respuesta de aceptar: con pending vacío y sesión restringida, `session` trae la sesión normal. */
export type LegalAcceptResultDto<TSession = unknown> = Readonly<{
  pending: PendingDocumentDto[];
  session: TSession | null;
}>;

const PUBLIC = `${ApiPathEnum.RESTAURANT}/public/v1/legal`;

/** Aceptación y lectura de documentos legales (backoffice). Error global: 428 LEGAL_ACCEPTANCE_REQUIRED. */
@Injectable({ providedIn: 'root' })
export class LegalApiService {
  readonly #http = inject(HttpClient);

  /** Versión vigente (404 si no tiene). */
  getCurrent(code: string, lang?: string, businessSlug?: string): Observable<LegalVersionDto> {
    const params: Record<string, string> = {};
    if (lang) params['lang'] = lang;
    if (businessSlug) params['businessSlug'] = businessSlug;
    return this.#http.get<LegalVersionDto>(`${PUBLIC}/documents/${encodeURIComponent(code)}`, { params });
  }

  /** Versión exacta (también las retiradas). */
  getVersion(versionId: number): Observable<LegalVersionDto> {
    return this.#http.get<LegalVersionDto>(`${PUBLIC}/versions/${versionId}`);
  }

  /**
   * Versiones vigentes de varios documentos, listas para aceptar. Los que no tienen versión publicada (404) no se
   * piden; si la lectura falla por otra razón también se omiten y el backend responde 400 con los que falten.
   */
  currentDocuments(codes: readonly LegalDocumentCode[], lang?: string): Observable<PendingDocumentDto[]> {
    if (!codes.length) return of([]);
    return forkJoin(
      codes.map((code) =>
        this.getCurrent(code, lang).pipe(
          map((version): PendingDocumentDto | null => versionAsPending(version)),
          catchError(() => of(null)),
        ),
      ),
    ).pipe(map((documents) => documents.filter((document): document is PendingDocumentDto => !!document)));
  }

  accept<TSession = unknown>(versionIds: number[]): Observable<LegalAcceptResultDto<TSession>> {
    return this.#http.post<LegalAcceptResultDto<TSession>>(`${ApiPathEnum.AUTH}/legal/accept`, { versionIds });
  }

  me(lang?: string): Observable<LegalMeDto> {
    return this.#http.get<LegalMeDto>(`${ApiPathEnum.AUTH}/legal/me`, { params: lang ? { lang } : {} });
  }
}

/** Una versión vigente como documento por aceptar (los de registro, negocio y API son obligatorios). */
export function versionAsPending(version: LegalVersionDto, isRequired = true): PendingDocumentDto {
  return {
    documentCode: version.documentCode,
    title: version.title,
    versionId: version.versionId,
    version: version.version,
    language: version.language,
    isRequired,
    isMaterialChange: version.isMaterialChange,
    effectiveAt: version.effectiveAt,
    url: `/restaurant/api/public/v1/legal/versions/${version.versionId}`,
  };
}
