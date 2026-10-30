import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RedomLogoComponent } from 'src/ui/atoms/redom-logo/redom-logo.component';
import { Icon } from '../ui/icon';
import { APP_LINKS } from '../ui/links';
import { LandingTheme } from '../ui/theme';

@Component({
  selector: 'lnd-site-header',
  imports: [Icon, RedomLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="lnd-header-glass fixed inset-x-0 top-0 z-50 border-b border-border/70">
      <nav class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Principal">
        <a href="#inicio" class="flex items-center rounded-md" aria-label="REDOM, ir al inicio" (click)="open.set(false)">
          <app-redom-logo decorative class="h-6" />
        </a>

        <ul class="hidden items-center gap-7 text-sm font-medium md:flex">
          @for (link of links; track link.href) {
          <li><a [href]="link.href" class="text-muted-foreground hover:text-foreground transition-colors">{{ link.label }}</a></li>
          }
        </ul>

        <div class="hidden items-center gap-2 md:flex">
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground hover:bg-muted flex size-10 items-center justify-center rounded-full transition-colors"
            [attr.aria-label]="'Apariencia: ' + modeInfo().label + '. Cambiar'"
            [title]="'Apariencia: ' + modeInfo().label"
            (click)="theme.cycleMode()">
            <lnd-icon [name]="modeInfo().icon" class="size-5" />
          </button>
          <a [href]="app.signIn" class="hover:text-primary rounded-full px-4 py-2 text-sm font-semibold transition-colors">Ingresar</a>
          <a [href]="app.signUp" class="bg-primary rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">Crear cuenta</a>
        </div>

        <div class="flex items-center gap-1 md:hidden">
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground hover:bg-muted flex size-10 items-center justify-center rounded-full transition-colors"
            [attr.aria-label]="'Apariencia: ' + modeInfo().label + '. Cambiar'"
            [title]="'Apariencia: ' + modeInfo().label"
            (click)="theme.cycleMode()">
            <lnd-icon [name]="modeInfo().icon" class="size-5" />
          </button>
        <button
          type="button"
          class="flex size-10 items-center justify-center rounded-lg"
          [attr.aria-expanded]="open()"
          aria-controls="mobile-menu"
          [attr.aria-label]="open() ? 'Cerrar menú' : 'Abrir menú'"
          (click)="open.set(!open())">
          <lnd-icon [name]="open() ? 'close' : 'menu'" class="size-6" />
        </button>
        </div>
      </nav>

      @if (open()) {
      <div id="mobile-menu" class="border-t border-border/70 px-4 pb-5 pt-3 md:hidden">
        <ul class="space-y-1">
          @for (link of links; track link.href) {
          <li><a [href]="link.href" class="hover:bg-muted block rounded-lg px-3 py-2.5 font-medium" (click)="open.set(false)">{{ link.label }}</a></li>
          }
        </ul>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <a [href]="app.signIn" class="rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold">Ingresar</a>
          <a [href]="app.signUp" class="bg-primary rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white">Crear cuenta</a>
        </div>
      </div>
      }
    </header>
  `,
})
export class SiteHeader {
  protected readonly app = APP_LINKS;
  protected readonly open = signal(false);
  protected readonly theme = inject(LandingTheme);
  protected readonly modeInfo = computed(() => {
    const mode = this.theme.mode();
    if (mode === 'light') return { icon: 'sun' as const, label: 'Claro' };
    if (mode === 'dark') return { icon: 'moon' as const, label: 'Oscuro' };
    return { icon: 'system' as const, label: 'Sistema' };
  });
  protected readonly links = [
    { href: '#funciones', label: 'Funciones' },
    { href: '#tu-marca', label: 'Tu marca' },
    { href: '#como-funciona', label: 'Cómo funciona' },
    { href: '#precios', label: 'Precios' },
    { href: '#preguntas', label: 'Preguntas' },
  ];
}
