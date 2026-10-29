import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MenuDesignVersionDto } from 'src/app/modules/public-menu/data-access';
import { safeZone } from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { cardStyleName, fontName, templateName } from 'src/app/modules/public-menu/features/menu-design-shared';
import { ButtonComponent, IconComponent, SkeletonComponent } from 'src/ui';

// Colores por defecto de la carta para la miniatura (pizarra: fondo oscuro).
const THUMB_DEFAULTS = { primary: '#E11D48', background: '#FFFFFF', text: '#1F2937' } as const;
const CHALK = { background: '#262626', text: '#F5F5F5' } as const;

/**
 * Pestaña Historial: las últimas 10 versiones (diseño, colores, portada, historia y anuncio), con miniatura,
 * para verlas en la vista previa o volver a ellas.
 */
@Component({
  selector: 'app-menu-design-history',
  imports: [ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass rounded-[1rem] p-4 sm:p-5">
      <h2 class="text-foreground font-semibold">Historial</h2>
      <p class="text-muted-foreground mb-3 text-sm">
        Cada vez que cambias el diseño, los colores, la portada o la historia, lo anterior queda aquí. Míralo en la vista previa y vuelve a él si quieres.
      </p>

      @if (error()) {
      <div class="flex flex-col items-center gap-3 py-8 text-center">
        <app-icon class="text-destructive h-10 w-10" aria-hidden="true">error_outline</app-icon>
        <p class="text-muted-foreground text-sm">{{ error() }}</p>
        <app-button impact="light" size="small" type="button" (buttonClick)="retry.emit()">Reintentar</app-button>
      </div>
      } @else if (loading() && !versions().length) {
      <div class="space-y-3">
        @for (row of [1, 2, 3]; track row) {
        <app-skeleton size="sm" style="width: 100%" />
        }
      </div>
      } @else {
      <ul class="divide-y divide-[var(--border)]" [class.opacity-60]="loading()">
        @for (version of versions(); track version.id) {
        @let viewing = viewingId() === version.id;
        @let colors = thumbColors(version);
        <li class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" [class.bg-primary/5]="viewing">
          <div class="flex min-w-0 items-center gap-3">
            <!-- Miniatura: plantilla y colores de esa versión -->
            <div class="flex h-14 w-11 shrink-0 flex-col gap-1 overflow-hidden rounded-md p-1 ring-1 ring-black/10" [style.background-color]="colors.background" aria-hidden="true">
              <span class="h-1.5 w-2/3 rounded-sm" [style.background-color]="colors.text"></span>
              @switch (version.design.template) {
              @case ('grid') {
              <span class="grid flex-1 grid-cols-2 gap-0.5">
                @for (cell of [1, 2, 3, 4]; track cell) {
                <span class="rounded-sm opacity-70" [style.background-color]="colors.primary"></span>
                }
              </span>
              }
              @case ('magazine') {
              <span class="h-4 w-full rounded-sm opacity-70" [style.background-color]="colors.primary"></span>
              <span class="h-1 w-full rounded-sm opacity-40" [style.background-color]="colors.text"></span>
              <span class="h-3 w-full rounded-sm opacity-50" [style.background-color]="colors.primary"></span>
              }
              @default {
              @for (row of [1, 2, 3]; track row) {
              <span class="flex items-center gap-0.5">
                <span class="h-1 flex-1 rounded-sm opacity-50" [style.background-color]="colors.text"></span>
                <span class="h-1 w-1.5 rounded-sm" [style.background-color]="colors.primary"></span>
              </span>
              }
              }
              }
            </div>
            <div class="min-w-0">
              <p class="text-foreground text-sm font-medium">{{ date(version.createdAt) }}</p>
              <p class="text-muted-foreground truncate text-xs">{{ version.createdBy?.name || 'Sin autor' }}</p>
              <p class="text-muted-foreground text-xs">
                {{ templateName(version.design.template) }}, letra {{ fontName(version.design.font).toLowerCase() }}, tarjetas {{ cardStyleName(version.design.cardStyle).toLowerCase() }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 gap-2">
            @if (viewing) {
            <app-button type="button" impact="light" size="small" (buttonClick)="view.emit(null)">Dejar de ver</app-button>
            } @else {
            <app-button type="button" impact="light" size="small" (buttonClick)="view.emit(version)">Ver</app-button>
            }
            @if (canRestore()) {
            <app-button type="button" impact="bold" size="small" [isLoading]="restoringId() === version.id" [disabled]="restoringId() !== null" (buttonClick)="restore.emit(version)">
              Volver a este diseño
            </app-button>
            }
          </div>
        </li>
        } @empty {
        <li class="text-muted-foreground py-8 text-center text-sm">Aún no hay versiones anteriores. Aparecerán cuando guardes cambios en el diseño o en los colores.</li>
        }
      </ul>
      }
    </section>
  `,
})
export class MenuDesignHistoryComponent {
  readonly versions = input<readonly MenuDesignVersionDto[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly viewingId = input<number | null>(null);
  readonly restoringId = input<number | null>(null);
  readonly canRestore = input(false);
  readonly timeZone = input<string | null>(null);
  readonly view = output<MenuDesignVersionDto | null>();
  readonly restore = output<MenuDesignVersionDto>();
  readonly retry = output<void>();

  protected readonly templateName = templateName;
  protected readonly fontName = fontName;
  protected readonly cardStyleName = cardStyleName;

  /** Colores de la versión; los que no se eligieron, los de la carta por defecto. */
  protected thumbColors(version: MenuDesignVersionDto): Readonly<{ primary: string; background: string; text: string }> {
    const theme = version.branding?.theme ?? {};
    const base = version.design.template === 'chalkboard' ? { ...THUMB_DEFAULTS, ...CHALK } : THUMB_DEFAULTS;
    return { primary: theme.primaryColor ?? base.primary, background: theme.backgroundColor ?? base.background, text: theme.textColor ?? base.text };
  }

  protected date(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat('es-CL', { timeZone: safeZone(this.timeZone()), dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
}
