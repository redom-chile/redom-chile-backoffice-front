import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { catchError, firstValueFrom, forkJoin, Observable, of } from 'rxjs';
import { ApiKeyDto, ApiKeyKind, CreatedApiKeyDto, PublicApiService } from 'src/app/modules/public-menu/data-access';
import { MAX_ORIGINS, normalizeOrigin, publicApiError } from 'src/app/modules/public-menu/features/public-api-shared';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { LegalApiService, legalDocumentsOf, legalErrorMessage, LegalMeDto, PendingDocumentDto, requiredAccepted } from 'src/app/core/services/legal';
import { LegalDocumentChecklistComponent } from 'src/app/modules/legal/ui';

export type ApiKeyFormModalData = Readonly<{ apiKey?: ApiKeyDto }>;
/** Al crear llega con `key` (mostrarla una vez); al editar, la llave guardada. */
export type ApiKeyFormModalResult = CreatedApiKeyDto | ApiKeyDto;

const NAME_MAX = 80;

/** Crear o editar una llave de API. */
@Component({
  selector: 'app-api-key-form-modal',
  imports: [ModalCardComponent, SlotDirective, ButtonComponent, IconComponent, LegalDocumentChecklistComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ apiKey ? 'Editar llave' : 'Nueva llave' }}</h2>
      </ng-template>

      <form class="space-y-5 p-2" (submit)="$event.preventDefault(); handleSubmit()">
        <div>
          <label for="api-key-name" class="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            id="api-key-name"
            type="text"
            [attr.maxlength]="nameMax"
            [value]="$name()"
            (input)="$name.set($any($event.target).value)"
            (blur)="$nameTouched.set(true)"
            placeholder="Ej: Sitio web, App de reservas"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="$showNameError()" />
          @if ($showNameError()) {
          <p class="text-destructive mt-1 text-xs">Ingresa un nombre.</p>
          }
        </div>

        @if (!apiKey) {
        <div>
          <span class="mb-1 block text-sm font-medium">Tipo *</span>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de llave">
            <label class="cursor-pointer">
              <input type="radio" name="kind" value="publishable" class="peer sr-only" [checked]="$kind() === 'publishable'" (change)="$kind.set('publishable')" />
              <span class="glass-row peer-checked:ring-primary block h-full rounded-lg p-3 peer-checked:ring-2 peer-focus-visible:ring-2">
                <span class="block text-sm font-semibold">Publicable (pk_live_)</span>
                <span class="text-muted-foreground block text-xs">Para usarla en la página de tu web, solo desde los orígenes que indiques.</span>
              </span>
            </label>
            <label class="cursor-pointer">
              <input type="radio" name="kind" value="secret" class="peer sr-only" [checked]="$kind() === 'secret'" (change)="$kind.set('secret')" />
              <span class="glass-row peer-checked:ring-primary block h-full rounded-lg p-3 peer-checked:ring-2 peer-focus-visible:ring-2">
                <span class="block text-sm font-semibold">Secreta (sk_live_)</span>
                <span class="text-muted-foreground block text-xs">Para el servidor de tu web: puede leer los pedidos del negocio.</span>
              </span>
            </label>
          </div>
        </div>
        }

        @if ($kind() === 'publishable') {
        <div>
          <label for="api-key-origin" class="mb-1 block text-sm font-medium">Orígenes permitidos *</label>
          <p class="text-muted-foreground mb-2 text-xs">
            Las webs desde donde se usará la llave. https:// (http solo para localhost), hasta {{ maxOrigins }}. Se guarda solo el origen.
          </p>
          @if ($origins().length) {
          <ul class="mb-2 flex flex-wrap gap-1.5" aria-label="Orígenes agregados">
            @for (origin of $origins(); track origin) {
            <li class="bg-muted/60 text-foreground inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 font-mono text-xs">
              <span class="truncate">{{ origin }}</span>
              <button
                type="button"
                class="text-muted-foreground hover:text-destructive inline-flex h-6 w-6 items-center justify-center rounded-full"
                [attr.aria-label]="'Quitar ' + origin"
                (click)="removeOrigin(origin)">
                <app-icon class="h-4 w-4">close</app-icon>
              </button>
            </li>
            }
          </ul>
          }
          <div class="flex gap-2">
            <input
              id="api-key-origin"
              type="url"
              inputmode="url"
              autocomplete="off"
              [value]="$draft()"
              (input)="onDraft($event)"
              (keydown.enter)="$event.preventDefault(); addOrigin()"
              [disabled]="$origins().length >= maxOrigins"
              placeholder="https://www.tusitio.cl"
              class="glass-input min-w-0 flex-1 rounded-md px-3 py-2 font-mono text-sm"
              [class.border-red-500]="$originError()" />
            <app-button type="button" impact="light" tone="primary" [disabled]="!$draft().trim() || $origins().length >= maxOrigins" (buttonClick)="addOrigin()">
              Agregar
            </app-button>
          </div>
          @if ($originError(); as error) {
          <p class="text-destructive mt-1 text-xs">{{ error }}</p>
          } @else if ($preview(); as preview) {
          <p class="text-muted-foreground mt-1 text-xs">Se guardará como <span class="text-foreground font-mono">{{ preview }}</span></p>
          } @else if ($showOriginsRequired()) {
          <p class="text-destructive mt-1 text-xs">Agrega al menos un origen.</p>
          }
          @if ($origins().length >= maxOrigins) {
          <p class="text-muted-foreground mt-1 text-xs">Llegaste al máximo de {{ maxOrigins }} orígenes.</p>
          }
        </div>
        } @else {
        <div class="flex items-start gap-2 rounded-lg bg-amber-500/15 p-3 text-sm text-amber-800 dark:text-amber-300">
          <app-icon class="h-5 w-5 shrink-0" aria-hidden="true">shield</app-icon>
          <p><span class="font-semibold">Úsala solo en el servidor de tu web; nunca en la página.</span> Quien la tenga puede leer los pedidos de tu negocio.</p>
        </div>
        }

        @if ($legalDocuments().length) {
        <app-legal-document-checklist legend="Términos de la API" [documents]="$legalDocuments()" [(accepted)]="$legalAccepted"
          [disabled]="$isSaving()" [showErrors]="$submitted()" />
        }
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-2">
          <app-button type="button" impact="light" tone="primary" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" tone="primary" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">
            {{ apiKey ? 'Guardar' : 'Crear llave' }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class ApiKeyFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<ApiKeyFormModalComponent, ApiKeyFormModalResult>>(MatDialogRef);
  readonly #data = inject<ApiKeyFormModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(PublicApiService);
  readonly #toast = inject(ToastService);
  readonly #legal = inject(LegalApiService);

  readonly apiKey = this.#data.apiKey ?? null;
  readonly nameMax = NAME_MAX;
  readonly maxOrigins = MAX_ORIGINS;

  readonly $name = signal(this.apiKey?.name ?? '');
  readonly $kind = signal<ApiKeyKind>(this.apiKey?.kind ?? 'publishable');
  readonly $origins = signal<string[]>([...(this.apiKey?.allowedOrigins ?? [])]);
  readonly $draft = signal('');
  readonly $originError = signal<string | null>(null);
  readonly $nameTouched = signal(false);
  readonly $submitted = signal(false);
  readonly $isSaving = signal(false);
  // Términos de la API: se aceptan con la primera llave (si el negocio aún no acepta la versión vigente).
  readonly $legalDocuments = signal<readonly PendingDocumentDto[]>([]);
  readonly $legalAccepted = signal<readonly number[]>([]);

  constructor() {
    if (!this.apiKey) this.#loadApiTerms();
  }

  #loadApiTerms() {
    forkJoin([this.#legal.currentDocuments(['apiTerms']), this.#legal.me().pipe(catchError(() => of<LegalMeDto | null>(null)))]).subscribe(
      ([current, me]) => {
        const accepted = (me?.accepted ?? []).filter((record) => record.documentCode === 'apiTerms' && record.action === 'accept');
        this.#showLegal(current.filter((document) => !accepted.some((record) => record.version >= document.version)));
      },
    );
  }

  #showLegal(documents: readonly PendingDocumentDto[]) {
    this.$legalDocuments.set(documents);
    this.$legalAccepted.set([]);
  }

  readonly $showNameError = computed(() => (this.$nameTouched() || this.$submitted()) && !this.$name().trim());
  readonly $showOriginsRequired = computed(() => this.$submitted() && this.$kind() === 'publishable' && !this.$origins().length);
  /** Vista previa del origen normalizado si difiere de lo escrito. */
  readonly $preview = computed(() => {
    const draft = this.$draft().trim();
    if (!draft) return null;
    const result = normalizeOrigin(draft);
    return 'origin' in result && result.origin !== draft ? result.origin : null;
  });

  onDraft(event: Event) {
    this.$draft.set((event.target as HTMLInputElement).value);
    this.$originError.set(null);
  }

  /** Agrega lo escrito (acepta varios separados por espacios o comas). */
  addOrigin(): boolean {
    const parts = this.$draft()
      .split(/[\s,]+/)
      .filter(Boolean);
    if (!parts.length) return true;
    const next = [...this.$origins()];
    for (const part of parts) {
      const result = normalizeOrigin(part);
      if ('error' in result) {
        this.$originError.set(result.error);
        return false;
      }
      if (!next.includes(result.origin)) next.push(result.origin);
    }
    if (next.length > MAX_ORIGINS) {
      this.$originError.set(`Hasta ${MAX_ORIGINS} orígenes por llave.`);
      return false;
    }
    this.$origins.set(next);
    this.$draft.set('');
    this.$originError.set(null);
    return true;
  }

  removeOrigin(origin: string) {
    this.$origins.update((list) => list.filter((item) => item !== origin));
  }

  async handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    // Lo que quedó escrito sin presionar Agregar también cuenta.
    if (this.$kind() === 'publishable' && this.$draft().trim() && !this.addOrigin()) return;
    const name = this.$name().trim();
    if (!name || (this.$kind() === 'publishable' && !this.$origins().length) || !requiredAccepted(this.$legalDocuments(), this.$legalAccepted())) {
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    this.$isSaving.set(true);
    try {
      let saved: ApiKeyFormModalResult;
      if (this.apiKey) {
        const dto: { name?: string; allowedOrigins?: string[] } = {};
        if (name !== this.apiKey.name) dto.name = name;
        if (this.apiKey.kind === 'publishable' && !sameList(this.$origins(), this.apiKey.allowedOrigins)) dto.allowedOrigins = this.$origins();
        if (!Object.keys(dto).length) {
          this.dialogRef.close();
          return;
        }
        saved = await firstValueFrom(this.#service.updateKey(this.apiKey.id, dto));
        this.#toast.show('Llave actualizada', 'success');
      } else {
        const kind = this.$kind();
        const acceptedVersionIds = this.$legalAccepted().length ? { acceptedVersionIds: [...this.$legalAccepted()] } : {};
        saved = await firstValueFrom(
          this.#service.createKey({ name, kind, ...(kind === 'publishable' ? { allowedOrigins: this.$origins() } : {}), ...acceptedVersionIds }),
        );
        this.#toast.show('Llave creada', 'success');
      }
      this.dialogRef.close(saved);
    } catch (error) {
      this.$isSaving.set(false);
      // Falta aceptar los términos de la API (o cambió la versión): se muestran para marcarlos.
      const legal = legalErrorMessage(error);
      if (legal) {
        this.#toast.show(legal, 'warning');
        const documents = legalDocumentsOf(error);
        if (documents?.length) this.#showLegal(documents);
        else this.#loadApiTerms();
        return;
      }
      const message = publicApiError(error, 'No se pudo guardar la llave.');
      if (message) this.#toast.show(message, 'error');
    }
  }
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function openApiKeyFormModal(dialog: MatDialog, data: ApiKeyFormModalData = {}): Observable<ApiKeyFormModalResult | undefined> {
  return dialog
    .open<ApiKeyFormModalComponent, ApiKeyFormModalData, ApiKeyFormModalResult>(ApiKeyFormModalComponent, {
      width: '600px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
