import { StorageFolder } from './dtos';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

const MB = 1024 * 1024;

// Mismos límites que el backend (libs/common/storage).
export const IMAGE_MAX_BYTES: Record<StorageFolder, number> = {
  products: 5 * MB,
  categories: 2 * MB,
  business_logos: 2 * MB,
  profile_images: 2 * MB,
  expense_documents: 10 * MB,
  billing_receipts: 10 * MB,
};

// Documentos (boleta, factura): imagen o PDF.
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;
export const DOCUMENT_ACCEPT = DOCUMENT_TYPES.join(',');

/** Como validateImage, pero acepta también PDF. */
export function validateDocument(file: File, folder: StorageFolder): string | null {
  if (!(DOCUMENT_TYPES as readonly string[]).includes(file.type)) return 'Formato no permitido. Usa JPG, PNG, WEBP o PDF.';
  const max = IMAGE_MAX_BYTES[folder];
  if (file.size > max) return `El archivo pesa ${formatBytes(file.size)}. El máximo es ${formatBytes(max)}.`;
  if (file.size === 0) return 'El archivo está vacío.';
  return null;
}

/** Mensaje de error si el archivo no cumple las reglas de la carpeta; null si es válido. */
export function validateImage(file: File, folder: StorageFolder): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Formato no permitido. Usa JPG, PNG o WEBP.';
  const max = IMAGE_MAX_BYTES[folder];
  if (file.size > max) return `La imagen pesa ${formatBytes(file.size)}. El máximo es ${formatBytes(max)}.`;
  if (file.size === 0) return 'El archivo está vacío.';
  return null;
}

export function formatBytes(bytes: number): string {
  return bytes >= MB ? `${(bytes / MB).toFixed(1).replace('.0', '')} MB` : `${Math.ceil(bytes / 1024)} KB`;
}
