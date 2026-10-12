import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DOCUMENT_ACCEPT, FileUploadService, ImageUploadError } from 'src/app/core/services/file-upload';
import { IconComponent, ToastService } from 'src/ui';

export type ExpenseDocumentValue = Readonly<{ fileId: string | null; url: string | null }>;

/**
 * Adjunto del gasto (foto o PDF de la boleta/factura). Se sube apenas se elige,
 * así al guardar solo se envía el fileId. Quitar emite fileId null.
 */
@Component({
  selector: 'app-expense-document-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input #fileInput type="file" class="hidden" [accept]="accept" (change)="handleFile($event)" />
    @if ($uploading()) {
    <div class="glass-input rounded-md px-3 py-2">
      <div class="flex items-center justify-between gap-2 text-sm">
        <span class="text-foreground min-w-0 truncate">Subiendo {{ $fileName() }}…</span>
        <span class="text-muted-foreground tabular-nums">{{ $progress() }}%</span>
      </div>
      <div class="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
        <div class="bg-primary h-full rounded-full transition-all" [style.width.%]="$progress()"></div>
      </div>
    </div>
    } @else if (fileId()) {
    <div class="glass-input flex flex-wrap items-center gap-2 rounded-md px-3 py-2">
      <app-icon class="text-primary h-5 w-5 shrink-0" aria-hidden="true">attach_file</app-icon>
      <span class="text-foreground min-w-0 flex-1 truncate text-sm">{{ $fileName() || 'Documento adjunto' }}</span>
      @if (url()) {
      <a [href]="url()" target="_blank" rel="noopener" class="text-primary text-sm font-medium hover:underline">Ver</a>
      }
      @if (!disabled()) {
      <button type="button" class="text-primary text-sm font-medium hover:underline" (click)="fileInput.click()">Cambiar</button>
      <button type="button" class="text-destructive text-sm font-medium hover:underline" (click)="handleRemove(fileInput)">Quitar</button>
      }
    </div>
    } @else {
    <button
      type="button"
      class="glass-input text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 rounded-md border-dashed px-3 py-3 text-sm"
      [disabled]="disabled()"
      (click)="fileInput.click()">
      <app-icon class="h-5 w-5" aria-hidden="true">upload_file</app-icon>
      Adjuntar foto o PDF (máx. 10 MB)
    </button>
    }
  `,
})
export class ExpenseDocumentFieldComponent {
  readonly #upload = inject(FileUploadService);
  readonly #toast = inject(ToastService);

  readonly fileId = input<string | null>(null);
  readonly url = input<string | null>(null);
  readonly disabled = input(false);
  readonly changed = output<ExpenseDocumentValue>();
  readonly uploadingChange = output<boolean>();

  readonly accept = DOCUMENT_ACCEPT;
  readonly $uploading = signal(false);
  readonly $fileName = signal<string | null>(null);
  readonly $progress = computed(() => this.#upload.$progress());

  async handleFile(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file || this.$uploading()) return;
    const previousName = this.$fileName();
    this.$fileName.set(file.name);
    this.#setUploading(true);
    try {
      const uploaded = await this.#upload.uploadDocument(file, 'expense_documents');
      this.changed.emit({ fileId: uploaded.fileId, url: uploaded.url });
    } catch (error) {
      this.$fileName.set(previousName);
      this.#toast.show(error instanceof ImageUploadError ? error.message : 'No se pudo subir el archivo. Inténtalo de nuevo.', 'error');
    } finally {
      this.#setUploading(false);
    }
  }

  handleRemove(inputEl: HTMLInputElement) {
    inputEl.value = '';
    this.$fileName.set(null);
    this.changed.emit({ fileId: null, url: null });
  }

  #setUploading(value: boolean) {
    this.$uploading.set(value);
    this.uploadingChange.emit(value);
  }
}
