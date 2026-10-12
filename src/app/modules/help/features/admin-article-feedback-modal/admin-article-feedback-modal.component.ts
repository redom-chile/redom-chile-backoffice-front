import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { formatDateTimeFull, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  ButtonComponent,
  IconComponent,
  ModalCardComponent,
  PaginationTableComponent,
  SkeletonComponent,
  SlotDirective,
} from 'src/ui';
import { getHelpErrorMessage, HelpAdminArticleItemDto, HelpAdminService } from '../../data-access';

export type AdminArticleFeedbackModalData = Readonly<{
  article: Pick<HelpAdminArticleItemDto, 'id' | 'title' | 'helpfulCount' | 'notHelpfulCount'>;
}>;

const PER_PAGE = 20;

/** Votos 👍/👎 y comentarios de un artículo, del más reciente al más antiguo. */
@Component({
  selector: 'app-admin-article-feedback-modal',
  imports: [ButtonComponent, IconComponent, ModalCardComponent, PaginationTableComponent, SkeletonComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Votos del artículo</h2>
        <p class="text-muted-foreground mt-1 truncate text-sm font-normal" [title]="article.title">{{ article.title }}</p>
        <div class="mt-2 flex gap-3 text-sm font-medium">
          <span class="text-green-700 dark:text-green-400">👍 {{ article.helpfulCount }}</span>
          <span class="text-red-700 dark:text-red-400">👎 {{ article.notHelpfulCount }}</span>
        </div>
      </ng-template>

      @if ($error(); as error) {
      <div class="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p class="text-foreground font-medium">No se pudieron cargar los votos</p>
        <p class="text-muted-foreground text-sm">{{ errorMessage(error) }}</p>
        <app-button type="button" impact="bold" (buttonClick)="votes.reload()">Reintentar</app-button>
      </div>
      } @else if (votes.isLoading()) {
      <div class="divide-y divide-[var(--border)]">
        @for (row of [1, 2, 3]; track row) {
        <div class="space-y-2 px-2 py-3">
          <app-skeleton size="xs" style="width: 160px" />
          <app-skeleton size="xs" style="width: 240px" />
        </div>
        }
      </div>
      } @else if (!$page()?.data?.length) {
      <div class="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <app-icon class="text-muted-foreground h-10 w-10">thumbs_up_down</app-icon>
        <p class="text-muted-foreground text-sm">Este artículo todavía no tiene votos.</p>
      </div>
      } @else {
      <ul class="divide-y divide-[var(--border)]">
        @for (vote of $page()!.data; track vote.id) {
        <li class="flex gap-3 px-2 py-3">
          <span class="text-lg leading-none" [attr.aria-label]="vote.helpful ? 'Útil' : 'No útil'">{{ vote.helpful ? '👍' : '👎' }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-foreground text-sm font-medium">
              {{ vote.businessName ?? 'Negocio #' + vote.businessId }}
              <span class="text-muted-foreground font-normal">· {{ vote.userName ?? 'Usuario eliminado' }}</span>
            </p>
            @if (vote.comment) {
            <p class="text-foreground mt-1 whitespace-pre-line break-words text-sm">{{ vote.comment }}</p>
            }
            <p class="text-muted-foreground mt-1 text-xs">{{ formatDate(vote.updatedAt) }}</p>
          </div>
        </li>
        }
      </ul>
      @if ($page()!.pagination.totalPages > 1) {
      <div class="border-t border-[var(--border)] px-2">
        <app-pagination-table [pagination]="$page()!.pagination" (pageChange)="$pageNumber.set($event)" />
      </div>
      }
      }

      <ng-template app-slot="footer">
        <div class="flex justify-end">
          <app-button type="button" impact="light" (buttonClick)="dialogRef.close()">Cerrar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class AdminArticleFeedbackModalComponent {
  readonly dialogRef = inject<MatDialogRef<AdminArticleFeedbackModalComponent>>(MatDialogRef);
  readonly #data = inject<AdminArticleFeedbackModalData>(MAT_DIALOG_DATA);
  readonly #help = inject(HelpAdminService);

  readonly article = this.#data.article;
  readonly formatDate = formatDateTimeFull;
  readonly $pageNumber = signal(1);

  readonly votes = rxResource({
    params: () => this.$pageNumber(),
    stream: ({ params }) => this.#help.getArticleFeedback(this.article.id, params, PER_PAGE).pipe(toRemoteResult()),
  });
  readonly $page = computed(() => resultValue(this.votes.value()));
  readonly $error = computed(() => resultError(this.votes.value()));

  errorMessage(error: unknown): string {
    return getHelpErrorMessage(error, 'Intenta nuevamente.');
  }
}

export function openAdminArticleFeedbackModal(dialog: MatDialog, data: AdminArticleFeedbackModalData): Observable<void> {
  return dialog
    .open<AdminArticleFeedbackModalComponent, AdminArticleFeedbackModalData>(AdminArticleFeedbackModalComponent, {
      width: '600px',
      maxWidth: '95vw',
      data,
    })
    .afterClosed();
}
