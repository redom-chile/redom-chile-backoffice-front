import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type CartaIconName =
  | 'whatsapp'
  | 'phone'
  | 'instagram'
  | 'globe'
  | 'map-pin'
  | 'clock'
  | 'chevron-down'
  | 'sliders'
  | 'x'
  | 'utensils'
  | 'alert'
  | 'refresh'
  | 'store'
  | 'chair'
  | 'chef-hat'
  | 'calendar'
  | 'tag'
  | 'package'
  | 'info'
  | 'chevron-left'
  | 'chevron-right'
  | 'external'
  | 'flame'
  | 'check';

/** Íconos SVG en línea (la landing no carga Material Symbols). Decorativos: aria-hidden. */
@Component({
  selector: 'app-carta-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (name()) {
        @case ('whatsapp') {
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
          <path d="M9.5 9.5c0 2.8 2.2 5 5 5l1-1.5-2-1-1 .8a3.5 3.5 0 0 1-1.8-1.8l.8-1-1-2z" />
        }
        @case ('phone') {
          <path
            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
          />
        }
        @case ('instagram') {
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        }
        @case ('globe') {
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        }
        @case ('map-pin') {
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
          <circle cx="12" cy="10" r="3" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        }
        @case ('chevron-down') {
          <path d="m6 9 6 6 6-6" />
        }
        @case ('sliders') {
          <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
        }
        @case ('x') {
          <path d="M18 6 6 18M6 6l12 12" />
        }
        @case ('utensils') {
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20" />
          <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
        }
        @case ('alert') {
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        }
        @case ('refresh') {
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        }
        @case ('store') {
          <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4M2 7h20" />
          <path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
        }
        @case ('chair') {
          <path d="M7 18v3M17 18v3M5 11V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6" />
          <path d="M3 11h18v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        }
        @case ('chef-hat') {
          <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.85.74-1.03a4 4 0 0 0-2.13-7.6 5 5 0 0 0-9.22 0 4 4 0 0 0-2.13 7.6c.42.18.74.57.74 1.03V20a1 1 0 0 0 1 1z" />
          <path d="M6 17h12" />
        }
        @case ('calendar') {
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        }
        @case ('tag') {
          <path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z" />
          <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
        }
        @case ('package') {
          <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
          <path d="M12 22V12M3.29 7 12 12l8.71-5M7.5 4.27l9 5.15" />
        }
        @case ('info') {
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        }
        @case ('chevron-left') {
          <path d="m15 18-6-6 6-6" />
        }
        @case ('chevron-right') {
          <path d="m9 18 6-6-6-6" />
        }
        @case ('external') {
          <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        }
        @case ('flame') {
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        }
        @case ('check') {
          <path d="M20 6 9 17l-5-5" />
        }
      }
    </svg>
  `,
})
export class CartaIcon {
  readonly name = input.required<CartaIconName>();
  readonly size = input(20);
}

/** Íconos de las etiquetas (el backend envía nombres tipo lucide): emoji livianos. */
const TAG_EMOJI: Record<string, string> = {
  leaf: '🌱',
  carrot: '🥕',
  wheat: '🌾',
  'wheat-off': '🌾',
  milk: '🥛',
  'milk-off': '🥛',
  'candy-off': '🍬',
  flame: '🌶️',
  sparkles: '✨',
  star: '⭐',
  shrimp: '🦐',
  egg: '🥚',
  fish: '🐟',
  nut: '🥜',
  bean: '🫘',
  salad: '🥬',
  droplet: '💧',
  seed: '🌰',
  wine: '🍷',
  shell: '🦪',
  flower: '🌼',
};

/** Emoji de una etiqueta; los "-off" (sin gluten, sin lactosa...) se tachan. */
@Component({
  selector: 'app-carta-tag-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-flex size-[1.15em] shrink-0 items-center justify-center leading-none', 'aria-hidden': 'true' },
  template: `
    <span class="text-[0.95em]">{{ emoji() }}</span>
    @if (off()) {
      <span class="absolute inset-x-0 top-1/2 h-[2px] -rotate-45 rounded-full bg-rose-600"></span>
    }
  `,
})
export class CartaTagIcon {
  readonly icon = input<string | null>(null);
  protected readonly emoji = computed(() => TAG_EMOJI[this.icon() ?? ''] ?? '•');
  protected readonly off = computed(() => (this.icon() ?? '').endsWith('-off'));
}
