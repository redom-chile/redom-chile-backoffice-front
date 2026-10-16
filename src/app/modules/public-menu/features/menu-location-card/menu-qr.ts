import { toDataURL } from 'qrcode';

/** PNG grande para imprimir en el mostrador o subir a Instagram. */
export function createMenuQrDataUrl(url: string): Promise<string> {
  return toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' });
}

/** "Café Ñuñoa" → "cafe-nunoa" (para el nombre del archivo). */
export function toFileSlug(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'carta';
}

export async function downloadMenuQr(url: string, fileName: string): Promise<void> {
  const link = document.createElement('a');
  link.href = await createMenuQrDataUrl(url);
  link.download = fileName;
  link.click();
}
