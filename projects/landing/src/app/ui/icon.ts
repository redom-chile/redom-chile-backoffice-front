import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'logo' | 'screen' | 'table' | 'chef' | 'printer' | 'qr' | 'chart' | 'calendar'
  | 'users' | 'check' | 'menu' | 'close' | 'arrow' | 'device' | 'plus' | 'sun' | 'moon' | 'system' | 'palette'
  | 'sparkles' | 'wallet' | 'receipt' | 'box' | 'recipe' | 'heart';

/** Íconos SVG livianos (sin fuentes externas), se renderizan también en el prerender. */
@Component({
  selector: 'lnd-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="size-full">
      @switch (name()) {
        @case ('logo') { <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 4-3 7h3v11" /> }
        @case ('screen') { <rect x="3" y="3" width="18" height="12" rx="2" /><path d="M8 21h8M12 15v6M7 8h4M7 11h7" /> }
        @case ('table') { <rect x="3" y="7" width="18" height="3" rx="1" /><path d="M6 10v9M18 10v9M9 4h6" /> }
        @case ('chef') { <path d="M7 14h10v6H7z" /><path d="M7 14a4 4 0 1 1 2-7.5A4 4 0 0 1 15 6.5 4 4 0 1 1 17 14" /> }
        @case ('printer') { <path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /> }
        @case ('qr') { <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3" /> }
        @case ('chart') { <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> }
        @case ('calendar') { <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /> }
        @case ('users') { <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /> }
        @case ('check') { <path d="M5 12.5l4.5 4.5L19 7.5" /> }
        @case ('menu') { <path d="M4 7h16M4 12h16M4 17h16" /> }
        @case ('close') { <path d="M6 6l12 12M18 6L6 18" /> }
        @case ('arrow') { <path d="M5 12h14M13 6l6 6-6 6" /> }
        @case ('device') { <rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /> }
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('sun') { <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /> }
        @case ('moon') { <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /> }
        @case ('system') { <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /> }
        @case ('palette') { <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="14.5" cy="7" r="1" /> }
        @case ('sparkles') { <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 2.5l.6 1.4L7 4.5l-1.4.6L5 6.5l-.6-1.4L3 4.5l1.4-.6z" /> }
        @case ('wallet') { <path d="M4 7a2 2 0 0 1 2-2h11v4" /><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M16 13.5h2" /> }
        @case ('receipt') { <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><path d="M9 7h6M9 11h6M9 15h4" /> }
        @case ('box') { <path d="M21 8l-9-5-9 5 9 5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /> }
        @case ('recipe') { <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6" /> }
        @case ('heart') { <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /> }
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
}
