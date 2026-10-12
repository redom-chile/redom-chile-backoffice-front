import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, signal } from '@angular/core';
import { IconComponent, ToastService } from 'src/ui';
import { getHelpErrorMessage, HelpService, HelpVoteDto } from '../../data-access';

const COMMENT_MAX = 500;

/** "¿Te sirvió?" de un artículo: un voto por usuario, votar de nuevo lo reemplaza. */
@Component({
  selector: 'app-article-feedback',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let vote = $vote();
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p class="text-foreground text-sm font-medium">¿Te sirvió este artículo?</p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors disabled:opacity-50"
          [class]="vote?.helpful === true ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground border-[var(--border)]'"
          [attr.aria-pressed]="vote?.helpful === true"
          [disabled]="$sending()"
          (click)="handleVote(true)">
          <app-icon class="h-4 w-4">{{ vote?.helpful === true ? 'thumb_up' : 'thumb_up_off_alt' }}</app-icon>
          Sí
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors disabled:opacity-50"
          [class]="vote?.helpful === false ? 'border-destructive bg-destructive/10 text-destructive' : 'text-muted-foreground hover:text-foreground border-[var(--border)]'"
          [attr.aria-pressed]="vote?.helpful === false"
          [disabled]="$sending()"
          (click)="handleVote(false)">
          <app-icon class="h-4 w-4">{{ vote?.helpful === false ? 'thumb_down' : 'thumb_down_off_alt' }}</app-icon>
          No
        </button>
      </div>
    </div>

    @if ($showComment()) {
    <div class="mt-3">
      <label class="text-muted-foreground mb-1 block text-xs" [attr.for]="commentId">¿Qué faltó? (opcional)</label>
      <textarea
        [id]="commentId"
        rows="3"
        class="glass-input text-foreground w-full resize-none rounded-md px-3 py-2 text-sm"
        placeholder="Cuéntanos qué no encontraste o qué no quedó claro"
        [maxLength]="commentMax"
        [value]="$comment()"
        (input)="handleComment($event)"></textarea>
      <div class="mt-1 flex items-center justify-between gap-2">
        <span class="text-muted-foreground text-xs tabular-nums">{{ $comment().length }}/{{ commentMax }}</span>
        <div class="flex items-center gap-3">
          <button type="button" class="text-muted-foreground hover:text-foreground text-sm font-medium" (click)="$showComment.set(false)">Omitir</button>
          <button
            type="button"
            class="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            [disabled]="!$comment().trim() || $sending()"
            (click)="handleSendComment()">
            Enviar
          </button>
        </div>
      </div>
    </div>
    } @else if (vote?.helpful === false && vote?.comment) {
    <p class="text-muted-foreground mt-2 text-xs">Tu comentario: "{{ vote?.comment }}"</p>
    }
  `,
})
export class ArticleFeedbackComponent {
  readonly #help = inject(HelpService);
  readonly #toast = inject(ToastService);

  readonly articleId = input.required<number>();
  readonly initial = input<HelpVoteDto | null>(null);

  readonly commentMax = COMMENT_MAX;
  readonly commentId = `help-article-comment-${Math.random().toString(36).slice(2, 8)}`;

  readonly $vote = linkedSignal(() => this.initial());
  readonly $comment = linkedSignal(() => this.initial()?.comment ?? '');
  readonly $showComment = linkedSignal<number, boolean>({ source: this.articleId, computation: () => false });
  readonly $sending = signal(false);

  handleVote(helpful: boolean) {
    const current = this.$vote();
    if (current?.helpful === helpful) {
      if (!helpful) this.$showComment.set(true);
      return;
    }
    this.#send(helpful, null);
  }

  handleComment(event: Event) {
    this.$comment.set((event.target as HTMLTextAreaElement).value);
  }

  handleSendComment() {
    const comment = this.$comment().trim();
    if (comment) this.#send(false, comment.slice(0, COMMENT_MAX));
  }

  #send(helpful: boolean, comment: string | null) {
    this.$sending.set(true);
    this.#help.voteArticle(this.articleId(), comment ? { helpful, comment } : { helpful }).subscribe({
      next: (vote) => {
        this.$sending.set(false);
        this.$vote.set(vote);
        this.$showComment.set(!helpful && !comment);
        if (helpful) this.$comment.set('');
        this.#toast.show(comment ? 'Gracias por contarnos qué faltó.' : 'Gracias por tu opinión.', 'success');
      },
      error: (error: unknown) => {
        this.$sending.set(false);
        this.#toast.show(getHelpErrorMessage(error, 'No se pudo guardar tu opinión.'), 'error');
      },
    });
  }
}
