import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { ImageSelection, StorageFolder, StoredFileDto, UploadedImage, UploadUrlDto } from './dtos';
import { validateDocument, validateImage } from './image-rules';
import { ImageUploadError, StorageForbiddenError } from './upload-error-message';

/**
 * Subida de imágenes en 3 pasos:
 * 1. POST /files/upload-url → URL firmada
 * 2. PUT directo a S3 (sin Authorization; solo los headers firmados)
 * 3. POST /files/:id/confirm
 * El fileId resultante se asocia después al recurso (imageFileId, logoFileId, profile/image).
 */
@Injectable({ providedIn: 'root' })
export class FileUploadService {
  readonly #http = inject(HttpClient);

  readonly #isUploading = signal(false);
  readonly #progress = signal(0);
  readonly $isUploading = this.#isUploading.asReadonly();
  /** 0–100 durante el PUT a S3. */
  readonly $progress = this.#progress.asReadonly();

  async uploadImage(file: File, folder: StorageFolder, fileName?: string): Promise<UploadedImage> {
    const invalid = validateImage(file, folder);
    if (invalid) throw new ImageUploadError(invalid);
    return this.#upload(file, folder, fileName);
  }

  /** Documento (imagen o PDF), por ejemplo la boleta o factura de un gasto. */
  async uploadDocument(file: File, folder: StorageFolder, fileName?: string): Promise<UploadedImage> {
    const invalid = validateDocument(file, folder);
    if (invalid) throw new ImageUploadError(invalid);
    return this.#upload(file, folder, fileName);
  }

  async #upload(file: File, folder: StorageFolder, fileName?: string): Promise<UploadedImage> {

    this.#isUploading.set(true);
    this.#progress.set(0);
    try {
      let target = await this.#requestUploadUrl(file, folder, fileName);
      try {
        await this.#putToStorage(target, file);
      } catch (error) {
        // 403: la URL firmada venció (15 min) o la firma no calza → se pide otra y se reintenta una vez.
        if (!(error instanceof StorageForbiddenError)) throw error;
        target = await this.#requestUploadUrl(file, folder, fileName);
        await this.#putToStorage(target, file);
      }

      const stored = await firstValueFrom(
        this.#http.post<StoredFileDto>(`${ApiPathEnum.RESTAURANT}/files/${target.fileId}/confirm`, {}),
      );
      if (stored.status !== 'UPLOADED') throw new ImageUploadError('La subida del archivo no se completó. Inténtalo de nuevo.');
      return { fileId: stored.id, url: stored.url };
    } finally {
      this.#isUploading.set(false);
    }
  }

  /**
   * Resuelve lo elegido en un formulario al valor a enviar:
   * undefined = no enviar el campo, null = quitar, string = nuevo fileId.
   */
  async resolveSelection(selection: ImageSelection, folder: StorageFolder): Promise<string | null | undefined> {
    if (selection.kind === 'keep') return undefined;
    if (selection.kind === 'remove') return null;
    return (await this.uploadImage(selection.file, folder)).fileId;
  }

  #requestUploadUrl(file: File, folder: StorageFolder, fileName?: string): Promise<UploadUrlDto> {
    return firstValueFrom(
      this.#http.post<UploadUrlDto>(`${ApiPathEnum.RESTAURANT}/files/upload-url`, {
        folder,
        contentType: file.type,
        sizeBytes: file.size,
        ...(fileName ? { fileName } : {}),
        originalName: file.name,
      }),
    );
  }

  // XHR en vez de fetch para poder mostrar el progreso; no pasa por HttpClient ni por el interceptor.
  #putToStorage(target: UploadUrlDto, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(target.method ?? 'PUT', target.uploadUrl);
      Object.entries(target.headers ?? {}).forEach(([name, value]) => xhr.setRequestHeader(name, value));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) this.#progress.set(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          this.#progress.set(100);
          resolve();
        } else if (xhr.status === 403) {
          reject(new StorageForbiddenError('El almacenamiento rechazó la imagen (firma inválida o vencida). Inténtalo de nuevo.'));
        } else {
          reject(new ImageUploadError(`No se pudo subir la imagen al almacenamiento (${xhr.status}).`));
        }
      };
      xhr.onerror = () => reject(new ImageUploadError('No hay conexión con el almacenamiento de imágenes.'));
      xhr.send(file);
    });
  }
}
