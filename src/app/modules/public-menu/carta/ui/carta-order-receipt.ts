import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { PublicOrderDto } from '../../data-access/dtos/customer-orders.dto';
import { PublicMenuApiService } from '../../data-access/public-menu-api.service';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { RECEIPT_MAX_BYTES, RECEIPT_TYPES } from '../carta-online';
import { CartaIcon } from './carta-icon';

type Row = Readonly<{ key: string; label: string; value: string }>;

/** Error del flujo del comprobante; refresh: el pedido ya no espera comprobante (409 RECEIPT_NOT_ALLOWED). */
class ReceiptError extends Error {
  constructor(
    message: string,
    readonly refresh = false,
  ) {
    super(message);
  }
}

function receiptError(error: unknown): ReceiptError {
  if (error instanceof ReceiptError) return error;
  const api = readApiError(error);
  if (api.code === 'RECEIPT_NOT_ALLOWED' || api.status === 409) return new ReceiptError('Este pedido ya no espera un comprobante', true);
  if (api.status === 0) return new ReceiptError('No hay conexión. Revisa tu internet');
  if (api.code === 'RATE_LIMITED' || api.status === 429) return new ReceiptError('Demasiados intentos, espera un minuto');
  if (api.status === 400) return new ReceiptError('No pudimos recibir el archivo. Revisa que sea una imagen o PDF de hasta 5 MB e intenta de nuevo');
  if (api.status === 404) return new ReceiptError('No encontramos este pedido');
  return new ReceiptError('No pudimos subir tu comprobante. Intenta de nuevo');
}

/**
 * Transferencia con comprobante (etapa 5): datos bancarios con botones para copiar, el monto y la subida del
 * comprobante (imagen o PDF ≤ 5 MB): POST receipt-upload-url → PUT uploadUrl (sin sesión, con exactamente los headers
 * recibidos) → POST receipt/confirm.
 */
@Component({
  selector: 'app-carta-order-receipt',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let o = order();
    <section class="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-4" aria-labelledby="carta-receipt-title">
      <h3 id="carta-receipt-title" class="flex items-center gap-2 text-base font-bold">
        <app-carta-icon name="wallet" [size]="18" class="text-amber-700 dark:text-amber-400" />
        Transfiere y sube tu comprobante
      </h3>
      <p class="mt-1 text-sm text-muted-foreground">El local confirmará tu pedido cuando revise la transferencia.</p>

      <dl class="mt-3 divide-y divide-border rounded-xl border border-border bg-card text-sm">
        @for (row of rows(); track row.key) {
          <div class="flex items-center gap-2 px-3 py-2">
            <dt class="w-28 shrink-0 text-muted-foreground">{{ row.label }}</dt>
            <dd class="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]" [class.tabular-nums]="row.key === 'amount' || row.key === 'number'">{{ row.value }}</dd>
            <button
              type="button"
              class="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              [attr.aria-label]="copied() === row.key ? row.label + ' copiado' : 'Copiar ' + row.label.toLowerCase()"
              (click)="copy(row)"
            >
              <app-carta-icon [name]="copied() === row.key ? 'check' : 'copy'" [size]="16" />
            </button>
          </div>
        }
      </dl>
      <p class="sr-only" aria-live="polite">{{ copied() ? 'Copiado' : '' }}</p>

      <div class="mt-4">
        <input id="carta-receipt-file" type="file" class="sr-only" [accept]="accept" (change)="onFile($any($event.target))" [disabled]="uploading()" />
        <label
          for="carta-receipt-file"
          class="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] motion-reduce:transition-none [input:focus-visible+&]:outline-2 [input:focus-visible+&]:outline-offset-2 [input:focus-visible+&]:outline-primary"
          [class.opacity-50]="uploading()"
          [class.pointer-events-none]="uploading()"
          [attr.aria-busy]="uploading() || null"
        >
          @if (uploading()) {
            <span class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true"></span>
            Subiendo comprobante…
          } @else {
            <app-carta-icon name="upload" [size]="18" />
            Subir comprobante
          }
        </label>
        <p class="mt-1.5 text-center text-xs text-muted-foreground">Imagen (JPG, PNG o WebP) o PDF, hasta 5 MB.</p>
      </div>

      @if (error(); as e) {
        <p class="mt-2 flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
          {{ e }}
        </p>
      }
      @if (!o.bankAccount) {
        <p class="mt-2 text-sm text-muted-foreground">Pide al local los datos para transferir.</p>
      }
    </section>
  `,
})
export class CartaOrderReceipt {
  readonly order = input.required<PublicOrderDto>();
  /** Comprobante recibido: el pedido con paymentStatus to_verify. */
  readonly updated = output<PublicOrderDto>();
  /** El pedido ya no espera comprobante: volver a consultarlo. */
  readonly refresh = output<void>();

  readonly #api = inject(PublicMenuApiService);
  #destroyed = false;
  #copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly accept = RECEIPT_TYPES.join(',');
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal<string | null>(null);

  protected readonly rows = computed<Row[]>(() => {
    const o = this.order();
    const b = o.bankAccount;
    const list: Row[] = [];
    if (b) {
      list.push({ key: 'bank', label: 'Banco', value: b.bank });
      list.push({ key: 'type', label: 'Tipo de cuenta', value: b.accountType });
      list.push({ key: 'number', label: 'N° de cuenta', value: b.accountNumber });
      list.push({ key: 'holder', label: 'Titular', value: b.holderName });
      list.push({ key: 'rut', label: 'RUT', value: b.holderRut });
      if (b.email) list.push({ key: 'email', label: 'Correo', value: b.email });
    }
    list.push({ key: 'amount', label: 'Monto', value: formatMenuPrice(o.total) });
    return list.filter((r) => r.value);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      if (this.#copyTimer) clearTimeout(this.#copyTimer);
    });
  }

  protected async copy(row: Row): Promise<void> {
    // El monto se copia sin formato (solo dígitos), como lo pide el banco
    const text = row.key === 'amount' ? String(Math.round(this.order().total)) : row.value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      } catch {
        return;
      }
    }
    this.copied.set(row.key);
    if (this.#copyTimer) clearTimeout(this.#copyTimer);
    this.#copyTimer = setTimeout(() => this.copied.set(null), 2000);
  }

  protected async onFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploading()) return;
    this.error.set(null);
    if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) {
      this.error.set('Sube una imagen (JPG, PNG o WebP) o un PDF');
      return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      this.error.set('El archivo pesa más de 5 MB');
      return;
    }
    if (!file.size) {
      this.error.set('El archivo está vacío');
      return;
    }
    const id = this.order().id;
    this.uploading.set(true);
    try {
      const upload = await firstValueFrom(
        this.#api.createReceiptUploadUrl(id, { contentType: file.type, sizeBytes: file.size, originalName: file.name.slice(0, 200) }),
      );
      let response: Response;
      try {
        // Exactamente los headers recibidos, sin sesión
        response = await fetch(upload.uploadUrl, { method: upload.method || 'PUT', headers: upload.headers, body: file });
      } catch {
        throw new ReceiptError('No pudimos subir el archivo. Revisa tu conexión e intenta de nuevo');
      }
      if (!response.ok) throw new ReceiptError('No pudimos subir el archivo. Intenta de nuevo');
      const order = await firstValueFrom(this.#api.confirmReceipt(id, upload.fileId));
      if (this.#destroyed) return;
      this.updated.emit(order);
    } catch (e) {
      if (this.#destroyed) return;
      const err = receiptError(e);
      this.error.set(err.message);
      if (err.refresh) this.refresh.emit();
    } finally {
      if (!this.#destroyed) this.uploading.set(false);
    }
  }
}
