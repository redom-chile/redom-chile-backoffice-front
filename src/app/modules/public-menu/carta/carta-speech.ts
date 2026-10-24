import { Injectable, signal } from '@angular/core';
import { PublicProductDto } from '../data-access/dtos/public-menu.dto';
import { cartaLocale, ct } from './carta-i18n';
import { cheapestVariation } from './carta-marketing';

/** Precio para leer en voz alta: "12990 pesos" (los separadores de miles confunden a algunas voces). */
export function spokenPrice(product: PublicProductDto): string | null {
  const v = cheapestVariation(product);
  if (!v) return null;
  const amount = String(Math.round(v.price));
  const same = product.variations.every((x) => x.price === product.variations[0].price);
  return ct(same ? 'design.price' : 'design.priceFrom', { amount });
}

/** Nombre, descripción, nota del chef y precio; detailed: el precio de cada variación. */
export function productSpeech(product: PublicProductDto, detailed = false): string[] {
  const parts = [product.name, product.description ?? ''];
  if (product.chefNote) parts.push(`${ct('design.chefNote')}: ${product.chefNote}`);
  if (detailed && product.variations.length > 1) {
    for (const v of product.variations) parts.push(`${v.name}: ${ct('design.price', { amount: Math.round(v.price) })}`);
  } else parts.push(spokenPrice(product) ?? '');
  if (product.soldOut) parts.push(ct('common.soldOut'));
  return parts;
}

function pickVoice(voices: readonly SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const lang = locale.slice(0, 2).toLowerCase();
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  return voices.find((v) => norm(v) === locale.toLowerCase()) ?? voices.find((v) => norm(v).startsWith(lang)) ?? null;
}

/** Lectura en voz alta (Web Speech API) en el idioma de la carta. Una sola lectura a la vez. */
@Injectable({ providedIn: 'root' })
export class CartaSpeech {
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  /** Id de lo que se está leyendo. */
  readonly speaking = signal<string | null>(null);
  #last: SpeechSynthesisUtterance | null = null;

  toggle(id: string, parts: readonly string[]): void {
    if (this.speaking() === id) this.stop();
    else this.speak(id, parts);
  }

  speak(id: string, parts: readonly string[]): void {
    if (!this.supported) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const locale = cartaLocale();
    const voice = pickVoice(synth.getVoices(), locale);
    // Frases cortas: Chrome corta las lecturas largas
    const chunks = parts.map((p) => p.trim()).filter(Boolean);
    if (!chunks.length) return this.stop();
    let last: SpeechSynthesisUtterance | null = null;
    for (const text of chunks) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = locale;
      if (voice) u.voice = voice;
      synth.speak(u);
      last = u;
    }
    const done = () => {
      if (this.#last === last) this.stop(false);
    };
    last!.onend = done;
    last!.onerror = done;
    this.#last = last;
    this.speaking.set(id);
  }

  stop(cancel = true): void {
    this.#last = null;
    this.speaking.set(null);
    if (cancel && this.supported) window.speechSynthesis.cancel();
  }

  /** Detiene solo si se está leyendo `id` (p. ej. al cerrar su detalle). */
  stopIf(id: string): void {
    if (this.speaking() === id) this.stop();
  }
}
