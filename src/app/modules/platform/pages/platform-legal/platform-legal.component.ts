import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AccessService } from 'src/app/core/permissions';
import { LEGAL_DOCUMENT_CODES } from 'src/app/core/services/legal';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  formatPlatformDate,
  getLegalErrorMessage,
  LEGAL_AUDIENCE_LABELS,
  LEGAL_PERMISSIONS,
  LEGAL_STANDARD_PRESETS,
  LegalDocumentDto,
  LegalStatsDto,
  PlatformLegalService,
} from '../../data-access';
import { LegalAuditComponent } from '../../features/legal-audit';
import { openLegalDocumentModal } from '../../features/legal-document-modal';

type LegalTab = 'documents' | 'audit';

/** Plataforma → Legal: documentos con su versión vigente y la auditoría de aceptaciones (?tab=audit). */
@Component({
  selector: 'app-platform-legal',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, LegalAuditComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-legal.component.html',
})
export class PlatformLegalComponent {
  readonly #legal = inject(PlatformLegalService);
  readonly #access = inject(AccessService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);

  readonly audienceLabels = LEGAL_AUDIENCE_LABELS;
  readonly formatDate = formatPlatformDate;
  readonly skeletonRows = [1, 2, 3, 4];

  readonly $canManage = computed(() => this.#access.owns(LEGAL_PERMISSIONS.MANAGE_DOCUMENTS));
  readonly $canSeeAudit = computed(() => this.#access.owns(LEGAL_PERMISSIONS.SEE_AUDIT));
  readonly $canExport = computed(() => this.#access.owns(LEGAL_PERMISSIONS.EXPORT_AUDIT));

  readonly $tab = toSignal(this.#route.queryParamMap.pipe(map((params): LegalTab => (params.get('tab') === 'audit' ? 'audit' : 'documents'))), {
    initialValue: 'documents' as LegalTab,
  });

  readonly documents = rxResource({ stream: () => this.#legal.getDocuments().pipe(toRemoteResult()) });
  readonly $documents = computed(() => resultValue(this.documents.value()) ?? []);
  readonly $error = computed(() => resultError(this.documents.value()));
  readonly $errorMessage = computed(() => getLegalErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly #stats = rxResource({ stream: () => this.#legal.getStats().pipe(toRemoteResult()) });
  readonly $statsById = computed(() => new Map((resultValue(this.#stats.value()) ?? []).map((row) => [row.documentId, row])));

  /** Códigos estándar que todavía no existen como documento de plataforma. */
  readonly $missingCodes = computed(() => {
    if (this.documents.isLoading() || this.$error()) return [];
    const existing = new Set(this.$documents().filter((d) => d.scope === 'platform').map((d) => d.code));
    return LEGAL_DOCUMENT_CODES.filter((code) => !existing.has(code));
  });
  readonly presets = LEGAL_STANDARD_PRESETS;
  readonly $creatingCode = signal<string | null>(null);

  selectTab(tab: LegalTab) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams: { tab: tab === 'audit' ? 'audit' : null }, queryParamsHandling: 'merge' });
  }

  /** % de aceptación de la versión vigente, sumando todas las audiencias. */
  acceptance(document: LegalDocumentDto): number | null {
    const stats: LegalStatsDto | undefined = this.$statsById().get(document.id);
    if (!stats?.current || !stats.audiences.length) return null;
    const total = stats.audiences.reduce((sum, row) => sum + row.total, 0);
    const accepted = stats.audiences.reduce((sum, row) => sum + row.accepted, 0);
    return total ? Math.round((accepted / total) * 1000) / 10 : 0;
  }

  handleCreate() {
    openLegalDocumentModal(this.#dialog)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((created) => {
        if (created) this.#router.navigate(['/platform/legal', created.id]);
      });
  }

  handleCreateStandard(code: (typeof LEGAL_DOCUMENT_CODES)[number]) {
    if (this.$creatingCode()) return;
    const preset = LEGAL_STANDARD_PRESETS[code];
    this.$creatingCode.set(code);
    this.#legal
      .createDocument({ code, title: preset.title, audiences: preset.audiences, isRequired: preset.isRequired, scope: 'platform' })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.$creatingCode.set(null);
          this.#toast.show(`Documento ${code} creado`, 'success');
          this.documents.reload();
          this.#stats.reload();
        },
        error: (error: unknown) => {
          this.$creatingCode.set(null);
          this.#toast.show(getLegalErrorMessage(error, 'No se pudo crear el documento'), 'error');
        },
      });
  }
}
