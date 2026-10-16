import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal } from '@angular/core';
import { CARTA_LANG_META, CARTA_LANGS, CartaI18n, CartaLang, isCartaLang } from '../carta-i18n';

/** Selector de idioma (bandera del actual); se muestra si el local ofrece más de un idioma. */
@Component({
  selector: 'app-carta-language-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    @let current = meta[i18n.language()];
    <div class="relative">
      <button
        type="button"
        class="h-10 border-border bg-background/85 text-foreground hover:bg-muted focus-visible:outline-primary flex items-center justify-center gap-1 rounded-full border px-2.5 shadow-sm backdrop-blur transition focus-visible:outline-2"
        [attr.aria-label]="t('lang.current', { name: current.name })"
        aria-controls="carta-language-panel"
        aria-haspopup="true"
        [attr.aria-expanded]="open()"
        (click)="open.update((v) => !v)">
        <span class="text-lg leading-none" aria-hidden="true">{{ current.flag }}</span>
        <span class="text-xs font-semibold" aria-hidden="true">{{ current.code }}</span>
      </button>
      @if (open()) {
      <ul
        id="carta-language-panel"
        [attr.aria-label]="t('lang.label')"
        class="border-border bg-card text-foreground absolute right-0 top-12 z-40 w-48 max-w-[calc(100vw-2rem)] rounded-2xl border p-1.5 shadow-xl">
        @for (lang of options(); track lang) {
        <li>
          <button
            type="button"
            class="hover:bg-muted focus-visible:outline-primary flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition focus-visible:outline-2"
            [class.font-semibold]="lang === i18n.language()"
            [attr.lang]="lang"
            [attr.aria-current]="lang === i18n.language() ? 'true' : null"
            (click)="select(lang)">
            <span class="text-lg leading-none" aria-hidden="true">{{ meta[lang].flag }}</span>
            <span class="flex-1">{{ meta[lang].name }}</span>
            <span class="text-muted-foreground text-xs font-semibold" aria-hidden="true">{{ meta[lang].code }}</span>
          </button>
        </li>
        }
      </ul>
      }
    </div>
  `,
})
export class CartaLanguageMenu {
  /** Los que ofrece el local (menu.availableLanguages). */
  readonly languages = input.required<readonly string[]>();
  readonly choose = output<CartaLang>();

  protected readonly i18n = inject(CartaI18n);
  protected readonly t = this.i18n.t;
  protected readonly meta = CARTA_LANG_META;
  protected readonly open = signal(false);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** En el orden de CARTA_LANGS. */
  protected readonly options = computed(() => {
    const available = this.languages().filter(isCartaLang);
    return CARTA_LANGS.filter((lang) => available.includes(lang));
  });

  protected select(lang: CartaLang): void {
    this.open.set(false);
    if (lang !== this.i18n.language()) this.choose.emit(lang);
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.#host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
