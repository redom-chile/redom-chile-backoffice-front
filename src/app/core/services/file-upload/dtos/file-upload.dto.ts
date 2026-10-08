// expense_documents: boletas y facturas de gastos (imagen o PDF, hasta 10 MB).
export type StorageFolder = 'products' | 'categories' | 'business_logos' | 'profile_images' | 'expense_documents';

export type RequestUploadUrlDto = Readonly<{
  folder: StorageFolder;
  contentType: string;
  sizeBytes: number;
  fileName?: string;
  originalName?: string;
}>;

export type UploadUrlDto = Readonly<{
  fileId: string;
  key: string;
  method: 'PUT';
  uploadUrl: string;
  headers: Readonly<Record<string, string>>;
  expiresIn: number;
}>;

export type StoredFileDto = Readonly<{
  id: string;
  folder: StorageFolder;
  key: string;
  contentType: string;
  sizeBytes: number | null;
  originalName: string | null;
  status: string;
  url: string | null;
}>;

export type UploadedImage = Readonly<{ fileId: string; url: string | null }>;

/**
 * Lo que el usuario hizo con la imagen en un formulario:
 * - keep: no la tocó (al modificar NO se envía el campo)
 * - set: eligió un archivo nuevo (se sube al guardar)
 * - remove: la quitó (se envía null)
 */
export type ImageSelection = { kind: 'keep' } | { kind: 'set'; file: File } | { kind: 'remove' };
