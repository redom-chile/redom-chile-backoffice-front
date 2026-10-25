import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MENU_CATEGORY_ICONS, MenuCategoryIcon } from '../../data-access/dtos/menu-design.dto';

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
  | 'check'
  | 'bag'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'receipt'
  | 'bell'
  | 'star'
  | 'users'
  | 'user'
  | 'repeat'
  | 'wallet'
  | 'truck'
  | 'copy'
  | 'upload'
  | 'locate'
  | 'card'
  | 'banknote'
  | 'file'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'salad'
  | 'soup'
  | 'beef'
  | 'drumstick'
  | 'fish'
  | 'pizza'
  | 'burger'
  | 'sandwich'
  | 'egg'
  | 'croissant'
  | 'leaf'
  | 'baby'
  | 'cake'
  | 'ice-cream'
  | 'cookie'
  | 'coffee'
  | 'cup-soda'
  | 'glass-water'
  | 'beer'
  | 'wine'
  | 'martini'
  | 'speaker'
  | 'stop'
  | 'contrast'
  | 'megaphone'
  | 'book-open'
  | 'mail';

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
        @case ('bag') {
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('minus') {
          <path d="M5 12h14" />
        }
        @case ('trash') {
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
        }
        @case ('receipt') {
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        }
        @case ('bell') {
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        }
        @case ('star') {
          <path
            d="M11.53 2.3a.53.53 0 0 1 .94 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.02a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z"
            [attr.fill]="filled() ? 'currentColor' : 'none'"
          />
        }
        @case ('users') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        }
        @case ('mail') {
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        }
        @case ('user') {
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        }
        @case ('repeat') {
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        }
        @case ('wallet') {
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        }
        @case ('truck') {
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
          <circle cx="17" cy="18" r="2" />
          <circle cx="7" cy="18" r="2" />
        }
        @case ('copy') {
          <rect width="14" height="14" x="8" y="8" rx="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        }
        @case ('upload') {
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        }
        @case ('locate') {
          <path d="M2 12h3M19 12h3M12 2v3M12 19v3" />
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3" />
        }
        @case ('card') {
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M2 10h20" />
        }
        @case ('banknote') {
          <rect width="20" height="12" x="2" y="6" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        }
        @case ('file') {
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        }
        @case ('moon') {
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        }
        @case ('monitor') {
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <path d="M8 21h8M12 17v4" />
        }
        @case ('salad') {
          <path d="M7 21h10" />
          <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
          <path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1" />
          <path d="m13 12 4-4" />
          <path d="M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2" />
        }
        @case ('soup') {
          <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
          <path d="M7 21h10" />
          <path d="M19.5 12 22 6" />
          <path d="M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62" />
          <path d="M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62" />
          <path d="M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62" />
        }
        @case ('beef') {
          <circle cx="12.5" cy="8.5" r="2.5" />
          <path d="M12.5 2a6.5 6.5 0 0 0-6.22 4.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3A6.5 6.5 0 0 0 12.5 2Z" />
          <path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1 .31 2 6.49 6.49 0 0 1-2.6 5.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5" />
        }
        @case ('drumstick') {
          <path d="M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23" />
          <path d="m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59" />
        }
        @case ('fish') {
          <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" />
          <path d="M18 12v.5" />
          <path d="M16 17.93a9.77 9.77 0 0 1 0-11.86" />
          <path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33" />
          <path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4" />
          <path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98" />
        }
        @case ('pizza') {
          <path d="M15 11h.01" />
          <path d="M11 15h.01" />
          <path d="M16 16h.01" />
          <path d="m2 16 20 6-6-20A20 20 0 0 0 2 16" />
          <path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4" />
        }
        @case ('burger') {
          <path d="M12 16H4a2 2 0 1 1 0-4h16a2 2 0 1 1 0 4h-4.25" />
          <path d="M5 12a2 2 0 0 1-2-2 9 7 0 0 1 18 0 2 2 0 0 1-2 2" />
          <path d="M5 16a2 2 0 0 0-2 2 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 2 2 0 0 0-2-2" />
          <path d="m6.67 12 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2" />
        }
        @case ('sandwich') {
          <path d="m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777" />
          <path d="M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25" />
          <path d="M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9" />
          <path d="m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2" />
          <rect width="20" height="4" x="2" y="11" rx="1" />
        }
        @case ('egg') {
          <circle cx="11.5" cy="12.5" r="3.5" />
          <path d="M3 8c0-3.5 2.5-6 6.5-6 5 0 4.83 3 7.5 5s5 2 5 6c0 4.5-2.5 6.5-7 6.5-2.5 0-2.5 2.5-6 2.5s-7-2-7-5.5c0-3 1.5-3 1.5-5C3.5 10 3 9 3 8Z" />
        }
        @case ('croissant') {
          <path d="m4.6 13.11 5.79-3.21c1.89-1.05 4.79 1.78 3.71 3.71l-3.22 5.81C8.8 23.16.79 15.23 4.6 13.11Z" />
          <path d="m10.5 9.5-1-2.29C9.2 6.48 8.8 6 8 6H4.5C2.79 6 2 6.5 2 8.5a7.71 7.71 0 0 0 2 4.83" />
          <path d="M8 6c0-1.55.24-4-2-4-2 0-2.5 2.17-2.5 4" />
          <path d="m14.5 13.5 2.29 1c.73.3 1.21.7 1.21 1.5v3.5c0 1.71-.5 2.5-2.5 2.5a7.71 7.71 0 0 1-4.83-2" />
          <path d="M18 16c1.55 0 4-.24 4 2 0 2-2.17 2.5-4 2.5" />
        }
        @case ('leaf') {
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        }
        @case ('baby') {
          <path d="M9 12h.01" />
          <path d="M15 12h.01" />
          <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
          <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
        }
        @case ('cake') {
          <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
          <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
          <path d="M2 21h20" />
          <path d="M7 8v3M12 8v3M17 8v3" />
          <path d="M7 4h.01M12 4h.01M17 4h.01" />
        }
        @case ('ice-cream') {
          <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
          <path d="M17 7A5 5 0 0 0 7 7" />
          <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
        }
        @case ('cookie') {
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01" />
        }
        @case ('coffee') {
          <path d="M10 2v2M14 2v2M6 2v2" />
          <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
        }
        @case ('cup-soda') {
          <path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8" />
          <path d="M5 8h14" />
          <path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0" />
          <path d="m12 8 1-6h2" />
        }
        @case ('glass-water') {
          <path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z" />
          <path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0" />
        }
        @case ('beer') {
          <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
          <path d="M9 12v6M13 12v6" />
          <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" />
          <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
        }
        @case ('wine') {
          <path d="M8 22h8" />
          <path d="M7 10h10" />
          <path d="M12 15v7" />
          <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
        }
        @case ('martini') {
          <path d="M8 22h8" />
          <path d="M12 11v11" />
          <path d="m19 3-7 8-7-8Z" />
        }
        @case ('speaker') {
          <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
          <path d="M16 9a5 5 0 0 1 0 6" />
          <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
        }
        @case ('stop') {
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        }
        @case ('contrast') {
          <circle cx="12" cy="12" r="10" />
          <path d="M12 18a6 6 0 0 0 0-12v12z" fill="currentColor" />
        }
        @case ('megaphone') {
          <path d="m3 11 18-5v12L3 14v-3z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        }
        @case ('book-open') {
          <path d="M12 7v14" />
          <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
        }
      }
    </svg>
  `,
})
export class CartaIcon {
  readonly name = input.required<CartaIconName>();
  readonly size = input(20);
  /** Solo 'star': relleno. */
  readonly filled = input(false);
}

type MissingCategoryIcon = Exclude<MenuCategoryIcon, CartaIconName>;
/** Falla al compilar si falta dibujar algún ícono de MENU_CATEGORY_ICONS. */
const ALL_CATEGORY_ICONS: [MissingCategoryIcon] extends [never] ? true : MissingCategoryIcon = true;
const CATEGORY_ICONS: ReadonlySet<string> = new Set(ALL_CATEGORY_ICONS && MENU_CATEGORY_ICONS.map((i) => i.name));

/** Ícono de una categoría (nombre tipo lucide); los desconocidos no se dibujan. */
export const categoryIcon = (name: string | null | undefined): CartaIconName | null =>
  name && CATEGORY_ICONS.has(name) ? (name as CartaIconName) : null;

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
