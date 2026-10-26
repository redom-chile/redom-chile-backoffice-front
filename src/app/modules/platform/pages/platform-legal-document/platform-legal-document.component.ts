import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filter, map, Observable, of, switchMap, tap } from 'rxjs';
import { AccessService } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  formatPlatformDate,
  getLegalErrorMessage,
  LEGAL_AUDIENCE_LABELS,
  LEGAL_LANGUAGE_LABELS,
  LEGAL_PERMISSIONS,
  LEGAL_VERSION_STATE_LABELS,
  LEGAL_VERSION_STATE_TONES,
  LegalDocumentVersionDto,
  legalVersionState,
  PlatformLegalService,
  shortHash,
} from '../../data-access';
import { openLegalDocumentModal } from '../../features/legal-document-modal';
import { openLegalNotifyModal } from '../../features/legal-notify-modal';
import { confirmLegalPublish, confirmLegalRetire } from '../../features/legal-shared';
import { LegalStatsComponent } from '../../features/legal-stats';
import { LegalVersionEditorComponent } from '../../features/legal-version-editor';
import { copyLegalHash, openLegalVersionViewModal } from '../../features/legal-version-view-modal';

type EditorState = Readonly<{
  key: number;
  draft: LegalDocumentVersionDto | null;
  seed: Partial<Pick<LegalDocumentVersionDto, 'content' | 'language' | 'version'>> | null;
}>;

/** Detalle de un documento legal: datos, aceptación por audiencia, versiones y editor del borrador. */
@Component({
  selector: 'app-platform-legal-document',
  imports: [NgTemplateOutlet, RouterLink, ButtonComponent, IconComponent, SkeletonComponent, LegalStatsComponent, LegalVersionEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-legal-document.component.html',
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class PlatformLegalDocumentComponent {
  readonly #legal = inject(PlatformLegalService);
  readonly #access = inject(AccessService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #route = inject(ActivatedRoute);
  readonly #destroyRef = inject(DestroyRef);

  readonly audienceLabels = LEGAL_AUDIENCE_LABELS;
  readonly languageLabels = LEGAL_LANGUAGE_LABELS;
  readonly stateLabels = LEGAL_VERSION_STATE_LABELS;
  readonly stateTones = LEGAL_VERSION_STATE_TONES;
  readonly stateOf = legalVersionState;
  readonly shortHash = shortHash;
  readonly formatDate = formatPlatformDate;
  readonly copy = copyLegalHash();

  readonly $canManage = computed(() => this.#access.owns(LEGAL_PERMISSIONS.MANAGE_DOCUMENTS));
  readonly $canPublish = computed(() => this.#access.owns(LEGAL_PERMISSIONS.PUBLISH_DOCUMENTS));

  readonly $id = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('id')))), { initialValue: NaN });

  // No hay GET de un documento: se usa el listado.
  readonly documents = rxResource({ stream: () => this.#legal.getDocuments().pipe(toRemoteResult()) });
  readonly $document = computed(() => (resultValue(this.documents.value()) ?? []).find((d) => d.id === this.$id()) ?? null);
  readonly $error = computed(() => resultError(this.documents.value()));
  readonly $errorMessage = computed(() => getLegalErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly versions = rxResource({
    params: () => (Number.isFinite(this.$id()) ? this.$id() : undefined),
    stream: ({ params }) => this.#legal.getVersions(params).pipe(toRemoteResult()),
  });
  readonly $versions = computed(() => resultValue(this.versions.value()) ?? []);
  readonly $versionsError = computed(() => resultError(this.versions.value()));

  readonly stats = rxResource({
    params: () => (Number.isFinite(this.$id()) ? this.$id() : undefined),
    stream: ({ params }) => this.#legal.getStats(params).pipe(toRemoteResult()),
  });
  readonly $stats = computed(() => resultValue(this.stats.value())?.[0] ?? null);

  readonly $editor = signal<EditorState | null>(null);
  readonly $busyId = signal<number | null>(null);
  readonly editorRef = viewChild(LegalVersionEditorComponent);
  #editorKey = 0;

  hasUnsavedChanges(): boolean {
    return this.editorRef()?.hasUnsavedChanges() ?? false;
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  handleEditDocument() {
    const document = this.$document();
    if (!document) return;
    openLegalDocumentModal(this.#dialog, { document })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((saved) => {
        if (saved) {
          this.documents.reload();
          this.stats.reload();
        }
      });
  }

  /** Borrador nuevo con el contenido de la última versión en español como punto de partida. */
  handleNewVersion() {
    const base = this.$versions().find((v) => v.language === 'es' && v.status !== 'draft') ?? this.$versions().find((v) => v.status !== 'draft');
    this.#openEditor(null, base ? { content: base.content, language: base.language } : null);
  }

  /** Otro idioma de un número existente (parte del contenido de ese número). */
  handleAddLanguage(version: LegalDocumentVersionDto) {
    this.#openEditor(null, { content: version.content, version: version.version, language: '' });
  }

  handleEdit(version: LegalDocumentVersionDto) {
    if (this.$editor()?.draft?.id === version.id) return;
    this.#openEditor(version, null);
  }

  handleView(version: LegalDocumentVersionDto) {
    openLegalVersionViewModal(this.#dialog, { title: this.$document()?.title ?? '', version });
  }

  handleCloseEditor() {
    this.#confirmDiscard()
      .pipe(filter(Boolean), takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.$editor.set(null));
  }

  handleSaved() {
    this.versions.reload();
    this.documents.reload();
  }

  handlePublished() {
    this.$editor.set(null);
    this.#reloadAll();
  }

  /** Publica un borrador desde la tabla con la fecha que tenga guardada (o ahora). */
  handlePublish(version: LegalDocumentVersionDto) {
    const document = this.$document();
    if (!document || this.$busyId() !== null) return;
    if (this.$editor()?.draft?.id === version.id && this.hasUnsavedChanges()) {
      this.#toast.show('Ese borrador tiene cambios sin guardar: publícalo desde el editor', 'warning');
      return;
    }
    confirmLegalPublish(this.#dialog, document, version)
      .pipe(
        filter(Boolean),
        tap(() => this.$busyId.set(version.id)),
        switchMap(() => this.#legal.publishVersion(version.id)),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: (published) => {
          this.$busyId.set(null);
          const scheduled = !!published.effectiveAt && Date.parse(published.effectiveAt) > Date.now();
          this.#toast.show(scheduled ? 'Versión programada' : 'Versión publicada', 'success');
          if (this.$editor()?.draft?.id === version.id) this.$editor.set(null);
          this.#reloadAll();
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          this.#toast.show(getLegalErrorMessage(error, 'No se pudo publicar la versión'), 'error');
        },
      });
  }

  handleRetire(version: LegalDocumentVersionDto) {
    if (this.$busyId() !== null) return;
    confirmLegalRetire(this.#dialog, version.version, legalVersionState(version) === 'scheduled')
      .pipe(
        filter(Boolean),
        tap(() => this.$busyId.set(version.id)),
        switchMap(() => this.#legal.retireVersion(version.id)),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.#toast.show('Versión retirada', 'success');
          this.#reloadAll();
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          this.#toast.show(getLegalErrorMessage(error, 'No se pudo retirar la versión'), 'error');
        },
      });
  }

  /** Solo la vigente, con cambio material y de un documento obligatorio. */
  canNotify(version: LegalDocumentVersionDto): boolean {
    return this.$canPublish() && !!this.$document()?.isRequired && version.isMaterialChange && legalVersionState(version) === 'current';
  }

  handleNotify(version: LegalDocumentVersionDto) {
    openLegalNotifyModal(this.#dialog, { versionId: version.id, label: `${this.$document()?.title ?? ''} · versión ${version.version} (${version.language})` })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((sent) => {
        if (sent) this.versions.reload();
      });
  }

  #openEditor(draft: LegalDocumentVersionDto | null, seed: EditorState['seed']) {
    this.#confirmDiscard()
      .pipe(filter(Boolean), takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => {
        this.$editor.set({ key: ++this.#editorKey, draft, seed });
        setTimeout(() => globalThis.document?.getElementById('legal-editor-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      });
  }

  #confirmDiscard(): Observable<boolean> {
    if (!this.hasUnsavedChanges()) return of(true);
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Hay cambios sin guardar',
          message: 'Si sigues, se perderá lo que escribiste en el borrador y no está guardado.',
          confirmText: 'Descartar cambios',
          cancelText: 'Seguir editando',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(map((confirmed) => confirmed === true));
  }

  #reloadAll() {
    this.versions.reload();
    this.documents.reload();
    this.stats.reload();
  }
}
