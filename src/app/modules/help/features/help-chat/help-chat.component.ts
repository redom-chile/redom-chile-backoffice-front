import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, ToastService } from 'src/ui';
import { getHelpErrorMessage, HELP_ASSISTANT_DISCLAIMER, HelpService } from '../../data-access';
import { MarkdownComponent } from '../../ui';
import { HELP_QUESTION_MAX, HelpChatEntry, HelpChatStore } from './help-chat.store';

const COMMENT_MAX = 500;

/** Chat con el asistente: burbujas, respuesta en vivo, fuentes y 👍/👎 por respuesta. */
@Component({
  selector: 'app-help-chat',
  imports: [RouterLink, IconComponent, MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-col' },
  templateUrl: './help-chat.component.html',
})
export class HelpChatComponent {
  readonly #help = inject(HelpService);
  readonly #toast = inject(ToastService);
  protected readonly store = inject(HelpChatStore);

  /** Pantalla desde la que se pregunta (contexto para el asistente). */
  readonly route = input<string>();
  /** Sin preguntas disponibles: se ofrece buscar la pregunta en los artículos. */
  readonly searchRequested = output<string>();

  readonly disclaimer = HELP_ASSISTANT_DISCLAIMER;
  readonly questionMax = HELP_QUESTION_MAX;
  readonly commentMax = COMMENT_MAX;

  readonly $question = signal('');
  readonly $canSend = computed(() => {
    const length = this.$question().trim().length;
    return length > 0 && length <= HELP_QUESTION_MAX && !this.store.$streaming();
  });

  // 👎 con comentario opcional: id del mensaje con la caja abierta.
  readonly $commentFor = signal<string | null>(null);
  readonly $comment = signal('');
  readonly $voting = signal<string | null>(null);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly questionInput = viewChild<ElementRef<HTMLTextAreaElement>>('questionInput');

  constructor() {
    // Baja al final con cada mensaje o trozo de respuesta.
    afterRenderEffect(() => {
      this.store.$messages();
      this.$commentFor();
      const element = this.scroller()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }

  handleInput(event: Event) {
    this.$question.set((event.target as HTMLTextAreaElement).value);
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.send();
  }

  send() {
    if (!this.$canSend()) return;
    if (this.store.send(this.$question(), this.route())) {
      this.$question.set('');
      this.$commentFor.set(null);
    }
  }

  handleReset() {
    this.store.reset();
    this.$question.set('');
    this.$commentFor.set(null);
    this.questionInput()?.nativeElement.focus();
  }

  /** Pregunta del usuario que originó una respuesta (para buscarla en los artículos). */
  questionFor(message: HelpChatEntry): string {
    const messages = this.store.$messages();
    const index = messages.findIndex((item) => item.id === message.id);
    return messages[index - 1]?.role === 'user' ? messages[index - 1].content : '';
  }

  vote(message: HelpChatEntry, helpful: boolean) {
    if (!message.logId || this.$voting()) return;
    if (message.vote === helpful) {
      // 👎 repetido: reabre la caja de comentario.
      if (!helpful) this.$commentFor.set(message.id);
      return;
    }
    this.#sendVote(message, helpful, null);
  }

  sendComment(message: HelpChatEntry) {
    const comment = this.$comment().trim();
    if (!comment) {
      this.$commentFor.set(null);
      return;
    }
    this.#sendVote(message, false, comment.slice(0, COMMENT_MAX));
  }

  handleComment(event: Event) {
    this.$comment.set((event.target as HTMLTextAreaElement).value);
  }

  #sendVote(message: HelpChatEntry, helpful: boolean, comment: string | null) {
    if (!message.logId) return;
    this.$voting.set(message.id);
    this.#help.voteAnswer(message.logId, comment ? { helpful, comment } : { helpful }).subscribe({
      next: () => {
        this.$voting.set(null);
        this.store.setVote(message.id, helpful);
        this.$comment.set('');
        this.$commentFor.set(!helpful && !comment ? message.id : null);
        this.#toast.show(comment ? 'Gracias por contarnos qué faltó.' : 'Gracias por tu opinión.', 'success');
      },
      error: (error: unknown) => {
        this.$voting.set(null);
        this.#toast.show(getHelpErrorMessage(error, 'No se pudo guardar tu opinión.'), 'error');
      },
    });
  }
}
