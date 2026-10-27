import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { LegalAudience } from 'src/app/core/services/legal';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import {
  getLegalErrorMessage,
  LEGAL_AUDIENCE_LABELS,
  LEGAL_AUDIENCES,
  LEGAL_CODE_PATTERN,
  LEGAL_TITLE_MAX,
  LegalDocumentDto,
  legalInvalidField,
  LegalScope,
  PlatformLegalService,
} from '../../data-access';

export type LegalDocumentModalData = Readonly<{ document?: LegalDocumentDto }>;

/** Crear o editar un documento legal. Al editar, el código y el alcance no cambian. Devuelve el documento guardado. */
@Component({
  selector: 'app-legal-document-modal',
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ document ? 'Editar documento' : 'Nuevo documento' }}</h2>
      </ng-template>

      <form class="space-y-4 p-2" [formGroup]="form" (ngSubmit)="handleSubmit()">
        <div>
          <label for="legal-doc-code" class="mb-1 block text-sm font-medium">Código *</label>
          <input
            id="legal-doc-code"
            type="text"
            maxlength="60"
            formControlName="code"
            placeholder="platformTerms"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            class="glass-input w-full rounded-md px-3 py-2 font-mono text-sm disabled:opacity-60"
            [class.border-red-500]="invalid('code')" />
          @if (invalid('code')) {
            <p class="text-destructive mt-1 text-xs">{{ $serverField() === 'code' ? $serverMessage() : 'camelCase: empieza en minúscula, solo letras y números (ej: privacyPolicy).' }}</p>
          } @else {
            <p class="text-muted-foreground mt-1 text-xs">{{ document ? 'El código no se puede cambiar.' : 'No se puede cambiar después.' }}</p>
          }
        </div>

        <div>
          <label for="legal-doc-title" class="mb-1 block text-sm font-medium">Título *</label>
          <input
            id="legal-doc-title"
            type="text"
            [maxlength]="titleMax"
            formControlName="title"
            placeholder="Ej: Términos de uso de Redom"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="invalid('title')" />
          @if (invalid('title')) {
            <p class="text-destructive mt-1 text-xs">Ingresa el título (máximo {{ titleMax }} caracteres).</p>
          }
        </div>

        <fieldset>
          <legend class="mb-1 block text-sm font-medium">¿Quién lo acepta? *</legend>
          <div class="flex flex-wrap gap-2">
            @for (audience of audiences; track audience) {
              <button
                type="button"
                class="rounded-full border px-3 py-1 text-xs font-medium transition"
                [class]="$selected().includes(audience) ? 'border-transparent bg-primary text-primary-foreground' : 'border-[var(--border)] text-foreground hover:bg-primary/10'"
                [attr.aria-pressed]="$selected().includes(audience)"
                (click)="toggleAudience(audience)">
                {{ audienceLabels[audience] }}
              </button>
            }
          </div>
          @if ($audiencesInvalid()) {
            <p class="text-destructive mt-1 text-xs">Elige al menos una audiencia.</p>
          } @else {
            <p class="text-muted-foreground mt-1 text-xs">Negocios y clientes de la API lo acepta el negocio (su dueño); los demás, cada persona.</p>
          }
        </fieldset>

        @if (!document) {
          <fieldset>
            <legend class="mb-1 block text-sm font-medium">Alcance</legend>
            <div class="glass-input inline-flex rounded-md p-1" role="radiogroup">
              @for (option of scopes; track option.value) {
                <button
                  type="button"
                  role="radio"
                  class="rounded px-3 py-1.5 text-sm font-medium transition"
                  [attr.aria-checked]="$scope() === option.value"
                  [class]="$scope() === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
                  (click)="form.controls.scope.setValue(option.value)">
                  {{ option.label }}
                </button>
              }
            </div>
          </fieldset>
          @if ($scope() === 'business') {
            <div>
              <label for="legal-doc-business" class="mb-1 block text-sm font-medium">ID del negocio *</label>
              <input
                id="legal-doc-business"
                type="number"
                min="1"
                inputmode="numeric"
                formControlName="businessId"
                class="glass-input w-full rounded-md px-3 py-2"
                [class.border-red-500]="invalid('businessId')" />
              @if (invalid('businessId')) {
                <p class="text-destructive mt-1 text-xs">{{ $serverField() === 'businessId' ? $serverMessage() : 'Ingresa el ID del negocio.' }}</p>
              }
            </div>
          }
        } @else {
          <p class="text-muted-foreground text-xs">Alcance: {{ document.scope === 'business' ? 'negocio #' + document.businessId : 'plataforma' }} (no cambia).</p>
        }

        <label class="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span class="text-foreground block text-sm font-medium">Obligatorio</span>
            <span class="text-muted-foreground block text-xs">Si es obligatorio, se pide aceptarlo para seguir. Si no, la aceptación es opcional (ej: marketing).</span>
          </span>
          <input type="checkbox" role="switch" formControlName="isRequired" class="peer sr-only" />
          <span
            class="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[var(--primary)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 dark:bg-gray-600"
            aria-hidden="true"></span>
        </label>
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">{{ document ? 'Guardar' : 'Crear' }}</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class LegalDocumentModalComponent {
  readonly dialogRef = inject<MatDialogRef<LegalDocumentModalComponent, LegalDocumentDto>>(MatDialogRef);
  readonly #data = inject<LegalDocumentModalData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly #fb = inject(FormBuilder);
  readonly #legal = inject(PlatformLegalService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly document = this.#data?.document;
  readonly titleMax = LEGAL_TITLE_MAX;
  readonly audiences = LEGAL_AUDIENCES;
  readonly audienceLabels = LEGAL_AUDIENCE_LABELS;
  readonly scopes: ReadonlyArray<{ value: LegalScope; label: string }> = [
    { value: 'platform', label: 'Plataforma' },
    { value: 'business', label: 'Un negocio' },
  ];

  readonly form = this.#fb.group({
    code: this.#fb.nonNullable.control({ value: this.document?.code ?? '', disabled: !!this.document }, [Validators.required, Validators.pattern(LEGAL_CODE_PATTERN)]),
    title: this.#fb.nonNullable.control(this.document?.title ?? '', [Validators.required, Validators.maxLength(LEGAL_TITLE_MAX)]),
    scope: this.#fb.nonNullable.control<LegalScope>('platform'),
    businessId: this.#fb.control<number | null>(null),
    isRequired: this.#fb.nonNullable.control(this.document?.isRequired ?? true),
  });
  readonly $scope = toSignal(this.form.controls.scope.valueChanges, { initialValue: this.form.controls.scope.value });
  readonly $selected = signal<LegalAudience[]>([...(this.document?.audiences ?? [])]);
  readonly $isSaving = signal(false);
  readonly #submitted = signal(false);
  readonly $audiencesInvalid = computed(() => this.#submitted() && !this.$selected().length);
  readonly $serverField = signal<string | null>(null);
  readonly $serverMessage = signal('');

  constructor() {
    this.form.controls.scope.valueChanges.pipe(takeUntilDestroyed()).subscribe((scope) => {
      const control = this.form.controls.businessId;
      control.setValidators(scope === 'business' ? [Validators.required, Validators.min(1)] : []);
      control.updateValueAndValidity();
    });
  }

  invalid(name: 'code' | 'title' | 'businessId'): boolean {
    const control = this.form.controls[name];
    if (this.$serverField() === name) return true;
    return control.invalid && (control.touched || this.#submitted());
  }

  toggleAudience(audience: LegalAudience) {
    this.$selected.update((list) => (list.includes(audience) ? list.filter((item) => item !== audience) : [...list, audience]));
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$serverField.set(null);
    this.form.patchValue({ code: this.form.controls.code.value.trim(), title: this.form.controls.title.value.trim() });
    this.#submitted.set(true);
    if (this.form.invalid || !this.$selected().length) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los datos del documento', 'warning');
      return;
    }
    const { code, title, scope, businessId, isRequired } = this.form.getRawValue();
    const audiences = LEGAL_AUDIENCES.filter((audience) => this.$selected().includes(audience));
    const request$ = this.document
      ? this.#legal.updateDocument(this.document.id, { title, audiences, isRequired })
      : this.#legal.createDocument({ code, title, audiences, scope, isRequired, ...(scope === 'business' ? { businessId: Number(businessId) } : {}) });
    this.$isSaving.set(true);
    request$.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (saved) => {
        this.#toast.show(this.document ? 'Documento actualizado' : 'Documento creado. Ahora escribe su primera versión.', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const message = getLegalErrorMessage(error, 'No se pudo guardar el documento');
        this.$serverField.set(legalInvalidField(error));
        this.$serverMessage.set(message);
        this.#toast.show(message, 'error');
      },
    });
  }
}

export function openLegalDocumentModal(dialog: MatDialog, data: LegalDocumentModalData = {}): Observable<LegalDocumentDto | undefined> {
  return dialog
    .open<LegalDocumentModalComponent, LegalDocumentModalData, LegalDocumentDto>(LegalDocumentModalComponent, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}
