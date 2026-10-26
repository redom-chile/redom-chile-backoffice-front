import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, IconComponent, PaginationTableComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  formatPlatformDate,
  getLegalErrorMessage,
  LEGAL_ACTION_LABELS,
  LEGAL_CHANNEL_LABELS,
  LEGAL_SUBJECT_LABELS,
  LegalAuditFiltersDto,
  LegalDocumentDto,
  PlatformLegalService,
  shortHash,
  startOfDayInSantiago,
} from '../../data-access';
import { openLegalAnonymizeModal } from '../legal-anonymize-modal';
import { copyLegalHash } from '../legal-version-view-modal';
import { addDays } from '../business-shared';
import { downloadBlob, nowInSantiago } from '../payment-shared';

const PER_PAGE = 50;

type AuditFilters = Readonly<{ email: string; documentCode: string; businessId: string; from: string; to: string }>;
const EMPTY: AuditFilters = { email: '', documentCode: '', businessId: '', from: '', to: '' };

/** Auditoría de aceptaciones: filtros, tabla paginada, exportación CSV/PDF y anonimización por correo. */
@Component({
  selector: 'app-legal-audit',
  imports: [ButtonComponent, IconComponent, PaginationTableComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-audit.component.html',
})
export class LegalAuditComponent {
  readonly #legal = inject(PlatformLegalService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly documents = input<readonly LegalDocumentDto[]>([]);
  readonly canExport = input(true);

  readonly actionLabels = LEGAL_ACTION_LABELS;
  readonly channelLabels = LEGAL_CHANNEL_LABELS;
  readonly subjectLabels = LEGAL_SUBJECT_LABELS;
  readonly formatDate = formatPlatformDate;
  readonly shortHash = shortHash;
  readonly copy = copyLegalHash();
  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly today = nowInSantiago().date;

  /** Lo que se escribe; se aplica con "Buscar". */
  readonly $draft = signal<AuditFilters>(EMPTY);
  readonly $applied = signal<AuditFilters>(EMPTY);
  readonly $page = signal(1);
  readonly $exporting = signal<'csv' | 'pdf' | null>(null);

  readonly $documentCodes = computed(() => [...new Set(this.documents().map((d) => d.code))].sort());
  readonly $hasFilters = computed(() => Object.values(this.$applied()).some(Boolean));

  readonly audit = rxResource({
    params: () => ({ ...this.#toDto(this.$applied()), page: this.$page(), limit: PER_PAGE }),
    stream: ({ params }) => this.#legal.getAudit(params).pipe(toRemoteResult()),
  });
  readonly $result = computed(() => resultValue(this.audit.value()));
  readonly $error = computed(() => resultError(this.audit.value()));
  readonly $errorMessage = computed(() => getLegalErrorMessage(this.$error(), 'Intenta nuevamente.'));
  readonly $pagination = computed((): PaginationMeta | null => {
    const result = this.$result();
    return result ? { page: result.page, perPage: result.limit, totalItems: result.total, totalPages: Math.max(1, Math.ceil(result.total / result.limit)) } : null;
  });

  patch(changes: Partial<AuditFilters>) {
    this.$draft.update((value) => ({ ...value, ...changes }));
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  handleSearch() {
    const draft = this.$draft();
    if (draft.from && draft.to && draft.from > draft.to) {
      this.#toast.show('La fecha desde debe ser anterior o igual a la fecha hasta', 'warning');
      return;
    }
    if (draft.businessId && !(Number(draft.businessId) > 0)) {
      this.#toast.show('El ID del negocio debe ser un número', 'warning');
      return;
    }
    this.$applied.set({ ...draft, email: draft.email.trim().toLowerCase() });
    this.$page.set(1);
  }

  handleClear() {
    this.$draft.set(EMPTY);
    this.$applied.set(EMPTY);
    this.$page.set(1);
  }

  handlePageChange(page: number) {
    this.$page.set(page);
  }

  handleExport(format: 'csv' | 'pdf') {
    if (this.$exporting()) return;
    this.$exporting.set(format);
    this.#legal
      .exportAudit(format, this.#toDto(this.$applied()))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (response) => {
          this.$exporting.set(null);
          if (!response.body) return;
          downloadBlob(response.body, fileNameOf(response) ?? `auditoria-legal-${this.today}.${format}`);
          this.#toast.show('Exportación descargada', 'success');
        },
        error: async (error: unknown) => {
          this.$exporting.set(null);
          this.#toast.show(getLegalErrorMessage(await readBlobError(error), 'No se pudo exportar la auditoría'), 'error');
        },
      });
  }

  handleAnonymize() {
    openLegalAnonymizeModal(this.#dialog)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((records) => {
        if (records) this.audit.reload();
      });
  }

  #toDto(filters: AuditFilters): LegalAuditFiltersDto {
    return {
      email: filters.email || undefined,
      documentCode: filters.documentCode || undefined,
      businessId: filters.businessId ? Number(filters.businessId) : undefined,
      // Días completos en hora de Chile.
      from: filters.from ? startOfDayInSantiago(filters.from) : undefined,
      to: filters.to ? startOfDayInSantiago(addDays(filters.to, 1)) : undefined,
    };
  }
}

/** Nombre del archivo desde Content-Disposition (si el backend lo expone por CORS). */
function fileNameOf(response: HttpResponse<Blob>): string | null {
  const header = response.headers.get('Content-Disposition');
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

/** Con responseType blob, el error JSON llega como Blob: se lee para traducir el código. */
async function readBlobError(error: unknown): Promise<unknown> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) return error;
  try {
    const body: unknown = JSON.parse(await error.error.text());
    return new HttpErrorResponse({ error: body, headers: error.headers, status: error.status, statusText: error.statusText, url: error.url ?? undefined });
  } catch {
    return error;
  }
}
