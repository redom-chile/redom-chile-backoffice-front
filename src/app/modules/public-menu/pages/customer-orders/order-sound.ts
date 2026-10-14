/**
 * Aviso sonoro de pedido nuevo con Web Audio. Los navegadores solo dejan sonar después de una interacción
 * del usuario: el contexto se crea (o reanuda) en el primer clic o tecla y antes de eso no suena.
 */
export class OrderSound {
  #context: AudioContext | null = null;
  #unlocked = false;
  readonly #unlock = () => {
    this.#unlocked = true;
    try {
      this.#context ??= new AudioContext();
      void this.#context.resume();
    } catch {
      // Sin Web Audio no hay sonido.
    }
  };

  readonly #target: Document;

  constructor(target: Document) {
    this.#target = target;
    // Si ya hubo interacción en la pestaña (ej. el clic en el menú), el navegador deja crear el contexto.
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation?.hasBeenActive) this.#unlock();
    target.addEventListener('pointerdown', this.#unlock, { once: true, capture: true });
    target.addEventListener('keydown', this.#unlock, { once: true, capture: true });
  }

  /** Dos tonos cortos. */
  play() {
    const context = this.#context;
    if (!this.#unlocked || !context || context.state !== 'running') return;
    const start = context.currentTime;
    [880, 1320].forEach((frequency, index) => {
      const at = start + index * 0.18;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.17);
    });
  }

  destroy() {
    this.#target.removeEventListener('pointerdown', this.#unlock, { capture: true });
    this.#target.removeEventListener('keydown', this.#unlock, { capture: true });
    void this.#context?.close().catch(() => undefined);
    this.#context = null;
  }
}
