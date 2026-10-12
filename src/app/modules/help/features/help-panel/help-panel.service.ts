import { inject, Injectable, signal } from '@angular/core';
import { HelpChatStore } from '../help-chat/help-chat.store';

export type HelpPanelTab = 'articles' | 'chat';

/** Panel lateral de ayuda contextual (botón "?" del navbar). Al cerrarlo se corta la respuesta en curso. */
@Injectable({ providedIn: 'root' })
export class HelpPanelService {
  readonly #chat = inject(HelpChatStore);
  readonly #open = signal(false);
  readonly #tab = signal<HelpPanelTab>('articles');

  readonly $open = this.#open.asReadonly();
  readonly $tab = this.#tab.asReadonly();

  open(tab?: HelpPanelTab) {
    if (tab) this.#tab.set(tab);
    this.#open.set(true);
  }

  close() {
    if (!this.#open()) return;
    this.#open.set(false);
    this.#chat.abort();
  }

  toggle() {
    if (this.#open()) this.close();
    else this.open();
  }

  setTab(tab: HelpPanelTab) {
    this.#tab.set(tab);
  }
}
