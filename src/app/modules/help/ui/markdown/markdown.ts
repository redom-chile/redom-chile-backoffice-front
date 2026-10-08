import { Marked, Tokens } from 'marked';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Solo enlaces de la app (/ruta), http(s) y mailto: nada de javascript:, data:, etc. */
export function isSafeHref(href: string): boolean {
  return /^(\/(?!\/)|https?:\/\/|mailto:)/i.test(href.trim());
}

/**
 * Markdown seguro para artículos y respuestas del asistente:
 * el HTML crudo se muestra como texto, las imágenes como su texto alternativo
 * y los enlaces inseguros como texto. Angular además sanitiza el [innerHTML].
 */
const markdown = new Marked({
  gfm: true,
  breaks: false,
  async: false,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    image({ text }: Tokens.Image) {
      return escapeHtml(text);
    },
    link(this: { parser: { parseInline(tokens: Tokens.Link['tokens']): string } }, { href, title, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens);
      if (!isSafeHref(href)) return label;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}"${titleAttr}>${label}</a>`;
    },
  },
});

export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return '';
  return markdown.parse(source, { async: false }) as string;
}
