import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, Observable, of, switchMap, tap } from 'rxjs';
import { MarkdownComponent } from 'src/app/modules/help/ui/markdown';
import { ButtonComponent, IconComponent, ToastService } from 'src/ui';
import {
  getLegalErrorMessage,
  isoToSantiagoParts,
  LEGAL_CONTENT_MAX,
  LEGAL_LANGUAGE_LABELS,
  LEGAL_LANGUAGES,
  LEGAL_PDF_MAX_BYTES,
  LEGAL_SUMMARY_MAX,
  LegalDocumentDto,
  LegalDocumentVersionDto,
  legalInvalidField,
  PlatformLegalService,
  UpdateLegalVersionDto,
} from '../../data-access';
import { santiagoDateTimeToIso } from '../payment-shared';
import { confirmLegalPublish } from '../legal-shared';

// Igual que el backend: cualquier etiqueta HTML o esquema peligroso.
const HTML_TAG = /<\/?[a-zA-Z][\w-]*(\s[^>]*)?\/?>/;
const DANGEROUS = /javascript:|data:text\/html/i;

type DraftForm = Readonly<{
  content: string;
  language: string;
  /** '' = el siguiente número. Solo al crear. */
  versionNumber: string;
  changeSummary: string;
  isMaterialChange: boolean;
  effectiveDate: string;
  effectiveTime: string;
  fileId: string | null;
}>;

function formOf(draft: LegalDocumentVersionDto | null, presetVersion: number | null): DraftForm {
  const effective = isoToSantiagoParts(draft?.effectiveAt);
  return {
    content: draft?.content ?? '',
    language: draft?.language ?? 'es',
    versionNumber: draft ? String(draft.version) : presetVersion ? String(presetVersion) : '',
    changeSummary: draft?.changeSummary ?? '',
    isMaterialChange: draft?.isMaterialChange ?? true,
    effectiveDate: effective.date,
    effectiveTime: effective.date ? effective.time : '',
    fileId: draft?.fileId ?? null,
  };
}

/** Editor de un borrador: markdown con vista previa, idioma, resumen, cambio material, vigencia y PDF. */
@Component({
  selector: 'app-legal-version-editor',
  imports: [ButtonComponent, IconComponent, MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-version-editor.component.html',
})
export class LegalVersionEditorComponent implements OnInit {
  readonly #legal = inject(PlatformLegalService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly document = input.required<LegalDocumentDto>();
  /** null: borrador nuevo. */
  readonly draft = input<LegalDocumentVersionDto | null>(null);
  /** Todas las versiones del documento (para elegir número e idioma). */
  readonly versions = input<readonly LegalDocumentVersionDto[]>([]);
  /** Contenido inicial de un borrador nuevo (ej: copia de la vigente). */
  readonly seed = input<Partial<Pick<LegalDocumentVersionDto, 'content' | 'language' | 'version'>> | null>(null);
  readonly canPublish = input(true);

  readonly saved = output<LegalDocumentVersionDto>();
  readonly published = output<LegalDocumentVersionDto>();
  readonly closed = output<void>();

  readonly languages = LEGAL_LANGUAGES;
  readonly languageLabels = LEGAL_LANGUAGE_LABELS;
  readonly contentMax = LEGAL_CONTENT_MAX;
  readonly summaryMax = LEGAL_SUMMARY_MAX;

  readonly #baseline = signal<DraftForm>(formOf(null, null));
  readonly $form = signal<DraftForm>(formOf(null, null));
  readonly $current = signal<LegalDocumentVersionDto | null>(null);
  readonly $fileName = signal<string | null>(null);
  readonly $pdfUrl = signal<string | null>(null);
  readonly $view = signal<'write' | 'preview'>('write');
  readonly $isSaving = signal(false);
  readonly $isPublishing = signal(false);
  readonly $isUploading = signal(false);
  readonly $errorField = signal<string | null>(null);

  readonly $isNew = computed(() => !this.$current());
  readonly $isDirty = computed(() => {
    const a = this.$form();
    const b = this.#baseline();
    return (Object.keys(a) as (keyof DraftForm)[]).some((key) => a[key] !== b[key]);
  });
  readonly $busy = computed(() => this.$isSaving() || this.$isPublishing() || this.$isUploading());
  readonly $nextVersion = computed(() => Math.max(0, ...this.versions().map((v) => v.version)) + 1);
  readonly $existingNumbers = computed(() => [...new Set(this.versions().map((v) => v.version))].sort((a, b) => b - a));
  /** Idiomas que ya tiene el número elegido (sin contar este borrador). */
  readonly $takenLanguages = computed(() => {
    const form = this.$form();
    const number = form.versionNumber ? Number(form.versionNumber) : this.$current()?.version ?? this.$nextVersion();
    const own = this.$current()?.id;
    return new Set(this.versions().filter((v) => v.version === number && v.id !== own).map((v) => v.language));
  });
  readonly $contentError = computed(() => {
    const content = this.$form().content;
    if (this.$errorField() === 'content') return 'Revisa el contenido: solo markdown, sin HTML ni scripts.';
    if (content.length > LEGAL_CONTENT_MAX) return `Máximo ${LEGAL_CONTENT_MAX.toLocaleString('es-CL')} caracteres.`;
    if (HTML_TAG.test(content) || DANGEROUS.test(content)) return 'Solo markdown: quita las etiquetas HTML (por ejemplo <br> o <div>) y los enlaces javascript:.';
    return null;
  });
  readonly $effectiveIso = computed(() => {
    const { effectiveDate, effectiveTime } = this.$form();
    return effectiveDate ? santiagoDateTimeToIso(effectiveDate, effectiveTime || '00:00') : null;
  });
  readonly $isScheduled = computed(() => {
    const iso = this.$effectiveIso();
    return !!iso && Date.parse(iso) > Date.now();
  });
  readonly $effectiveInPast = computed(() => {
    const iso = this.$effectiveIso();
    return !!iso && Date.parse(iso) <= Date.now();
  });

  ngOnInit() {
    const draft = this.draft();
    const seed = this.seed();
    const initial = formOf(draft, null);
    const taken = new Set(this.versions().filter((v) => v.version === seed?.version).map((v) => v.language));
    const language = seed?.language || LEGAL_LANGUAGES.find((code) => !taken.has(code)) || 'es';
    const form = draft ? initial : { ...initial, content: seed?.content ?? '', language, versionNumber: seed?.version ? String(seed.version) : '' };
    this.$current.set(draft);
    this.$pdfUrl.set(draft?.pdfUrl ?? null);
    this.#baseline.set(form);
    this.$form.set(form);
  }

  hasUnsavedChanges(): boolean {
    return this.$isDirty();
  }

  patch(changes: Partial<DraftForm>) {
    this.$form.update((form) => ({ ...form, ...changes }));
    const field = this.$errorField();
    if (field && Object.keys(changes).some((key) => key === field || (key === 'versionNumber' && field === 'version') || (key.startsWith('effective') && field === 'effectiveAt'))) {
      this.$errorField.set(null);
    }
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  clearEffective() {
    this.patch({ effectiveDate: '', effectiveTime: '' });
  }

  async handlePdf(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.#toast.show('El archivo debe ser un PDF', 'warning');
      return;
    }
    if (file.size > LEGAL_PDF_MAX_BYTES) {
      this.#toast.show('El PDF no puede pesar más de 10 MB', 'warning');
      return;
    }
    this.$isUploading.set(true);
    try {
      const fileId = await this.#legal.uploadPdf(file);
      this.patch({ fileId });
      this.$fileName.set(file.name);
      this.$pdfUrl.set(null);
      this.#toast.show('PDF subido. Guarda el borrador para adjuntarlo.', 'success');
    } catch (error) {
      const message =
        error instanceof TypeError ? 'No hay conexión con el almacenamiento de archivos.' : error instanceof Error ? error.message : getLegalErrorMessage(error, 'No se pudo subir el PDF');
      this.#toast.show(message, 'error');
    } finally {
      this.$isUploading.set(false);
    }
  }

  removePdf() {
    this.patch({ fileId: null });
    this.$fileName.set(null);
    this.$pdfUrl.set(null);
  }

  handleSave() {
    if (this.$busy() || !this.#validate()) return;
    this.$isSaving.set(true);
    this.#save$()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (saved) => {
          this.$isSaving.set(false);
          this.#toast.show('Borrador guardado', 'success');
          this.saved.emit(saved);
        },
        error: (error: unknown) => this.#fail(error, 'No se pudo guardar el borrador'),
      });
  }

  handlePublish() {
    if (this.$busy() || !this.#validate()) return;
    const form = this.$form();
    const version = this.$current()?.version ?? (form.versionNumber ? Number(form.versionNumber) : this.$nextVersion());
    confirmLegalPublish(this.#dialog, this.document(), { version, language: form.language, isMaterialChange: form.isMaterialChange, effectiveAt: this.$effectiveIso() })
      .pipe(
        filter(Boolean),
        tap(() => this.$isPublishing.set(true)),
        // Primero se guardan los cambios pendientes; publicar usa lo guardado.
        switchMap(() => (this.$isDirty() || this.$isNew() ? this.#save$() : of(this.$current()!))),
        switchMap((saved) => this.#legal.publishVersion(saved.id, this.$isScheduled() ? this.$effectiveIso() : null)),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: (published) => {
          this.$isPublishing.set(false);
          this.#baseline.set(this.$form());
          this.#toast.show(this.$isScheduled() ? 'Versión programada' : 'Versión publicada', 'success');
          this.published.emit(published);
        },
        error: (error: unknown) => this.#fail(error, 'No se pudo publicar la versión'),
      });
  }

  #save$(): Observable<LegalDocumentVersionDto> {
    const form = this.$form();
    const current = this.$current();
    const body: UpdateLegalVersionDto = {
      content: form.content,
      language: form.language,
      changeSummary: form.changeSummary.trim() || null,
      isMaterialChange: form.isMaterialChange,
      effectiveAt: this.$effectiveIso(),
      ...(form.fileId !== (current?.fileId ?? null) ? { fileId: form.fileId } : {}),
    };
    const request$ = current
      ? this.#legal.updateVersion(current.id, body)
      : this.#legal.createVersion(this.document().id, { ...body, content: form.content, ...(form.versionNumber ? { version: Number(form.versionNumber) } : {}) });
    return request$.pipe(
      tap((saved) => {
        this.$current.set(saved);
        this.$pdfUrl.set(saved.pdfUrl);
        this.#baseline.set(form);
        this.$form.update((value) => ({ ...value, versionNumber: String(saved.version) }));
        this.#baseline.update((value) => ({ ...value, versionNumber: String(saved.version) }));
      }),
    );
  }

  #validate(): boolean {
    const form = this.$form();
    if (!form.content.trim()) {
      this.$errorField.set('content');
      this.#toast.show('Escribe el contenido del documento', 'warning');
      return false;
    }
    if (this.$contentError()) {
      this.#toast.show(this.$contentError()!, 'warning');
      return false;
    }
    if (this.$takenLanguages().has(form.language)) {
      this.$errorField.set('language');
      this.#toast.show('Esa versión ya tiene ese idioma: elige otro idioma u otro número', 'warning');
      return false;
    }
    if (form.changeSummary.length > LEGAL_SUMMARY_MAX) {
      this.$errorField.set('changeSummary');
      this.#toast.show(`El resumen admite hasta ${LEGAL_SUMMARY_MAX} caracteres`, 'warning');
      return false;
    }
    if (form.effectiveTime && !form.effectiveDate) {
      this.$errorField.set('effectiveAt');
      this.#toast.show('Elige la fecha de vigencia', 'warning');
      return false;
    }
    return true;
  }

  #fail(error: unknown, fallback: string) {
    this.$isSaving.set(false);
    this.$isPublishing.set(false);
    const field = legalInvalidField(error);
    this.$errorField.set(field === 'fileId' ? null : field);
    this.#toast.show(getLegalErrorMessage(error, fallback), 'error');
  }
}
