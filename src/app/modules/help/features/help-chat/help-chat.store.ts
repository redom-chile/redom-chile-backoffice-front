import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import {
  getHelpErrorMessage,
  HelpArticleLinkDto,
  HelpChatEvent,
  HelpChatMessageDto,
  HelpChatService,
  helpQuotaMessage,
} from '../../data-access';

export const HELP_QUESTION_MAX = 1000;
const HISTORY_MAX = 6;
const HISTORY_CONTENT_MAX = 2000;
// Se borra también al cerrar sesión (AuthService.clearSession).
export const HELP_CHAT_STORAGE_KEY = 'redom.help-chat';
const STORAGE_KEY = HELP_CHAT_STORAGE_KEY;
const INTERRUPTED = 'La respuesta se interrumpió.';

export type HelpChatStatus = 'streaming' | 'done' | 'error';

/** `quota`: se acabaron las preguntas del mes (se ofrece buscar en los artículos). */
export type HelpChatErrorKind = 'unavailable' | 'quota' | 'other';

export type HelpChatEntry = Readonly<{
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: HelpChatStatus;
  /** Artículos que usó la respuesta (solo de `done`). */
  sources: HelpArticleLinkDto[];
  /** Sugeridos por la búsqueda: se muestran solo si el asistente falla. */
  fallback: HelpArticleLinkDto[];
  logId: number | null;
  vote: boolean | null;
  error: string | null;
  errorKind: HelpChatErrorKind | null;
}>;

// owner: usuario y negocio dueños de la conversación (otra cuenta en la misma pestaña no la ve).
type StoredChat = Readonly<{ messages: HelpChatEntry[]; remaining: number | null; owner?: string | null }>;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function entry(role: HelpChatEntry['role'], content: string, status: HelpChatStatus): HelpChatEntry {
  return { id: newId(), role, content, status, sources: [], fallback: [], logId: null, vote: null, error: null, errorKind: null };
}

function readStorage(): StoredChat | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredChat>;
    if (!Array.isArray(parsed.messages)) return null;
    // Una respuesta que quedó a medias (recarga de la página) no se puede retomar.
    const messages = parsed.messages.map((message) =>
      message.status === 'streaming' ? { ...message, status: 'error' as const, error: INTERRUPTED, errorKind: 'other' as const } : message,
    );
    return {
      messages,
      remaining: typeof parsed.remaining === 'number' ? parsed.remaining : null,
      owner: typeof parsed.owner === 'string' ? parsed.owner : null,
    };
  } catch {
    return null;
  }
}

function writeStorage(value: StoredChat) {
  try {
    if (value.messages.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin sessionStorage (modo privado, cuota): la conversación queda solo en memoria.
  }
}

/**
 * Conversación con el asistente. El backend no guarda el historial: vive aquí (y en sessionStorage)
 * y se envían los últimos mensajes completos en cada pregunta.
 */
@Injectable({ providedIn: 'root' })
export class HelpChatStore {
  readonly #chat = inject(HelpChatService);
  readonly #whoami = inject(WhoamiService);
  readonly #owner = signal<string | null>(null);

  readonly #messages = signal<HelpChatEntry[]>([]);
  readonly #remaining = signal<number | null>(null);
  #subscription: Subscription | null = null;

  readonly $messages = this.#messages.asReadonly();
  /** Preguntas que le quedan al negocio este mes (llega en cada `done`). */
  readonly $remaining = this.#remaining.asReadonly();
  readonly $streaming = computed(() => this.#messages().some((message) => message.status === 'streaming'));

  constructor() {
    const stored = readStorage();
    if (stored) {
      this.#messages.set(stored.messages);
      this.#remaining.set(stored.remaining);
      this.#owner.set(stored.owner ?? null);
    }
    // Al conocer al usuario: si la conversación era de otra cuenta o negocio, se descarta.
    effect(() => {
      const user = this.#whoami.$whoami()?.user;
      if (!user) return;
      const owner = `${user.code}:${user.restaurantId ?? ''}`;
      if (owner === untracked(this.#owner)) return;
      if (untracked(this.#owner) !== null) {
        this.reset();
        this.#remaining.set(null);
      }
      this.#owner.set(owner);
    });
    effect(() => writeStorage({ messages: this.#messages(), remaining: this.#remaining(), owner: this.#owner() }));
  }

  send(question: string, route?: string): boolean {
    const text = question.trim();
    if (!text || text.length > HELP_QUESTION_MAX || this.$streaming()) return false;

    const history = this.#history();
    const user = entry('user', text, 'done');
    const answer = entry('assistant', '', 'streaming');
    this.#messages.update((messages) => [...messages, user, answer]);

    this.#subscription = this.#chat
      .ask({ question: text, route: route?.startsWith('/') ? route : undefined, history: history.length ? history : undefined })
      .subscribe({
        next: (event) => this.#handleEvent(answer.id, event),
        error: (error: unknown) => {
          this.#subscription = null;
          this.#handleHttpError(answer.id, error);
        },
        complete: () => {
          this.#subscription = null;
          // El stream terminó sin `done` ni `error`.
          const current = this.#messages().find((message) => message.id === answer.id);
          if (current?.status !== 'streaming') return;
          this.#patch(
            answer.id,
            current.content
              ? { status: 'done' }
              : { status: 'error', error: 'El asistente no respondió. Intenta nuevamente.', errorKind: 'unavailable' },
          );
        },
      });
    return true;
  }

  /** Corta la respuesta en curso (al cerrar el panel). */
  abort() {
    if (!this.#subscription) return;
    this.#subscription.unsubscribe();
    this.#subscription = null;
    this.#messages.update((messages) =>
      messages.map((message) => (message.status === 'streaming' ? { ...message, status: 'error', error: INTERRUPTED, errorKind: 'other' } : message)),
    );
  }

  reset() {
    this.abort();
    this.#messages.set([]);
  }

  setVote(id: string, vote: boolean) {
    this.#patch(id, { vote });
  }

  // Solo pares pregunta/respuesta completos, recortados al límite del backend.
  #history(): HelpChatMessageDto[] {
    const messages = this.#messages();
    const pairs: HelpChatMessageDto[] = [];
    messages.forEach((message, index) => {
      const next = messages[index + 1];
      if (message.role !== 'user' || next?.role !== 'assistant' || next.status !== 'done' || !next.content) return;
      pairs.push({ role: 'user', content: message.content.slice(0, HISTORY_CONTENT_MAX) });
      pairs.push({ role: 'assistant', content: next.content.slice(0, HISTORY_CONTENT_MAX) });
    });
    return pairs.slice(-HISTORY_MAX);
  }

  #handleEvent(id: string, event: HelpChatEvent) {
    switch (event.event) {
      case 'articles':
        this.#patch(id, { fallback: event.data ?? [] });
        break;
      case 'delta':
        this.#messages.update((messages) =>
          messages.map((message) => (message.id === id ? { ...message, content: message.content + (event.data?.text ?? '') } : message)),
        );
        break;
      case 'done':
        this.#patch(id, { status: 'done', sources: event.data.sources ?? [], logId: event.data.logId ?? null });
        if (typeof event.data.remaining === 'number') this.#remaining.set(event.data.remaining);
        break;
      case 'error':
        this.#patch(id, { status: 'error', error: 'El asistente no está disponible en este momento.', errorKind: 'unavailable' });
        break;
    }
  }

  #handleHttpError(id: string, error: unknown) {
    const { code } = readApiError(error);
    if (code === 'HELP_QUOTA_EXCEEDED') {
      this.#remaining.set(0);
      this.#patch(id, { status: 'error', error: helpQuotaMessage(error), errorKind: 'quota' });
      return;
    }
    this.#patch(id, { status: 'error', error: getHelpErrorMessage(error, 'No se pudo enviar la pregunta. Intenta nuevamente.'), errorKind: 'other' });
  }

  #patch(id: string, changes: Partial<HelpChatEntry>) {
    this.#messages.update((messages) => messages.map((message) => (message.id === id ? { ...message, ...changes } : message)));
  }
}
