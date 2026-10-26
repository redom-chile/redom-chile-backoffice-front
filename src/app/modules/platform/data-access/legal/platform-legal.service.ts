import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  CreateLegalDocumentDto,
  CreateLegalVersionDto,
  LegalAuditFiltersDto,
  LegalAuditPageDto,
  LegalDocumentDto,
  LegalDocumentVersionDto,
  LegalFileUploadDto,
  LegalNotifyResultDto,
  LegalStatsDto,
  UpdateLegalDocumentDto,
  UpdateLegalVersionDto,
} from './platform-legal.dto';

const BASE = `${ApiPathEnum.AUTH}/platform/legal`;

/** PDF de una versión: hasta 10 MB. */
export const LEGAL_PDF_MAX_BYTES = 10 * 1024 * 1024;

/** Plataforma → Legal (SUPERADMIN). Funciona aunque el superadmin tenga documentos por aceptar. */
@Injectable({ providedIn: 'root' })
export class PlatformLegalService {
  readonly #http = inject(HttpClient);

  // --- Documentos ---
  getDocuments(): Observable<LegalDocumentDto[]> {
    return this.#http.get<LegalDocumentDto[]>(`${BASE}/documents`);
  }

  createDocument(dto: CreateLegalDocumentDto): Observable<LegalDocumentDto> {
    return this.#http.post<LegalDocumentDto>(`${BASE}/documents`, dto);
  }

  updateDocument(id: number, dto: UpdateLegalDocumentDto): Observable<LegalDocumentDto> {
    return this.#http.patch<LegalDocumentDto>(`${BASE}/documents/${id}`, dto);
  }

  // --- Versiones ---
  getVersions(documentId: number): Observable<LegalDocumentVersionDto[]> {
    return this.#http.get<LegalDocumentVersionDto[]>(`${BASE}/documents/${documentId}/versions`);
  }

  createVersion(documentId: number, dto: CreateLegalVersionDto): Observable<LegalDocumentVersionDto> {
    return this.#http.post<LegalDocumentVersionDto>(`${BASE}/documents/${documentId}/versions`, dto);
  }

  /** Solo borradores: una publicada responde 400 LEGAL_VERSION_IMMUTABLE. */
  updateVersion(id: number, dto: UpdateLegalVersionDto): Observable<LegalDocumentVersionDto> {
    return this.#http.patch<LegalDocumentVersionDto>(`${BASE}/versions/${id}`, dto);
  }

  /** Sin effectiveAt: la del borrador o ahora. Calcula el hash y desde ahí no cambia. */
  publishVersion(id: number, effectiveAt?: string | null): Observable<LegalDocumentVersionDto> {
    return this.#http.post<LegalDocumentVersionDto>(`${BASE}/versions/${id}/publish`, effectiveAt ? { effectiveAt } : {});
  }

  /** Vuelve a regir la anterior. 400 LEGAL_VERSION_NOT_PUBLISHED si no está publicada. */
  retireVersion(id: number): Observable<LegalDocumentVersionDto> {
    return this.#http.post<LegalDocumentVersionDto>(`${BASE}/versions/${id}/retire`, {});
  }

  /** Avisa por correo a quienes faltan (hasta 200 por llamada, una vez por correo). */
  notifyVersion(id: number): Observable<LegalNotifyResultDto> {
    return this.#http.post<LegalNotifyResultDto>(`${BASE}/versions/${id}/notify`, {});
  }

  /** URL firmada para subir el PDF; el fileId se envía después en el borrador (el backend confirma la subida). */
  async uploadPdf(file: File): Promise<string> {
    const target = await firstValueFrom(
      this.#http.post<LegalFileUploadDto>(`${BASE}/files`, { fileName: file.name.slice(-200), contentType: 'application/pdf', sizeBytes: file.size }),
    );
    // fetch directo: sin Authorization ni interceptores, solo los headers firmados.
    const response = await fetch(target.uploadUrl, { method: target.method ?? 'PUT', headers: { ...target.headers }, body: file });
    if (!response.ok) throw new Error(`No se pudo subir el PDF al almacenamiento (${response.status}).`);
    return target.fileId;
  }

  // --- Estadísticas y auditoría ---
  getStats(documentId?: number): Observable<LegalStatsDto[]> {
    return this.#http.get<LegalStatsDto[]>(`${BASE}/stats`, { params: toHttpParams({ documentId }) });
  }

  getAudit(filters: LegalAuditFiltersDto): Observable<LegalAuditPageDto> {
    return this.#http.get<LegalAuditPageDto>(`${BASE}/audit`, { params: toHttpParams(filters) });
  }

  /** Hasta 20.000 registros con el hash de cada versión. */
  exportAudit(format: 'csv' | 'pdf', filters: LegalAuditFiltersDto): Observable<HttpResponse<Blob>> {
    const { page: _page, limit: _limit, ...rest } = filters;
    return this.#http.get(`${BASE}/audit/export`, { params: toHttpParams({ ...rest, format }), responseType: 'blob', observe: 'response' });
  }

  /** Reemplaza correo, IP y navegador por su sha256 en todos los registros (los registros se mantienen). */
  anonymize(email: string, reason?: string | null): Observable<{ records: number }> {
    return this.#http.post<{ records: number }>(`${BASE}/anonymize`, { email, reason: reason || null });
  }
}
