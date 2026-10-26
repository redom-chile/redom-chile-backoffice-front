import { Injectable } from '@angular/core';
import { AutomationDto, AutomationType } from './dtos';
import { AUTOMATION_FALLBACK_DEFAULTS } from './messaging-format';

export type AutomationTexts = Readonly<{ subject: string; body: string; ctaLabel: string | null }>;

const STORAGE_KEY = 'redom.messaging.automationDefaults';

/**
 * Textos de Redom de cada automatización: se guardan la primera vez que el GET los trae sin cambios (isDefault),
 * para "Restaurar texto de Redom". Si nunca se vieron en este navegador, se usa la copia del front.
 */
@Injectable({ providedIn: 'root' })
export class AutomationDefaultsStore {
  #defaults: Partial<Record<AutomationType, AutomationTexts>> = this.#read();

  remember(automations: readonly AutomationDto[]) {
    let changed = false;
    for (const automation of automations) {
      if (!automation.isDefault) continue;
      const texts = { subject: automation.subject, body: automation.body, ctaLabel: automation.ctaLabel };
      const current = this.#defaults[automation.type];
      if (current && current.subject === texts.subject && current.body === texts.body && current.ctaLabel === texts.ctaLabel) continue;
      this.#defaults = { ...this.#defaults, [automation.type]: texts };
      changed = true;
    }
    if (changed) this.#write();
  }

  get(type: AutomationType): AutomationTexts {
    return this.#defaults[type] ?? AUTOMATION_FALLBACK_DEFAULTS[type];
  }

  #read(): Partial<Record<AutomationType, AutomationTexts>> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const value = raw ? (JSON.parse(raw) as unknown) : null;
      return value && typeof value === 'object' ? (value as Partial<Record<AutomationType, AutomationTexts>>) : {};
    } catch {
      return {};
    }
  }

  #write() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#defaults));
    } catch {
      // Sin almacenamiento: queda en memoria.
    }
  }
}
