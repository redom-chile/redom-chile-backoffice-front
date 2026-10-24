import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MenuDesignVersionDto } from 'src/app/modules/public-menu/data-access';
import { safeZone } from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { cardStyleName, fontName, templateName } from 'src/app/modules/public-menu/features/menu-design-shared';
import { ButtonComponent, IconComponent, SkeletonComponent } from 'src/ui';

/** Pestaña Historial: las últimas 10 versiones del diseño, para verlas en la vista previa o restaurarlas. */
@Component({
  selector: 'app-menu-design-history',
  imports: [ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass rounded-[1rem] p-4 sm:p-5">
      <h2 class="text-foreground font-semibold">Historial</h2>
      <p class="text-muted-foreground mb-3 text-sm">Cada vez que guardas el diseño, el anterior queda aquí. Míralo en la vista previa y vuelve a él si quieres.</p>

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
        <li class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" [class.bg-primary/5]="viewing">
          <div class="min-w-0">
            <p class="text-foreground text-sm font-medium">{{ date(version.createdAt) }}</p>
            <p class="text-muted-foreground text-xs">
              {{ version.createdBy?.name || 'Sin autor' }} · {{ templateName(version.design.template) }}, letra {{ fontName(version.design.font).toLowerCase() }}, tarjetas {{ cardStyleName(version.design.cardStyle).toLowerCase() }}
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            @if (viewing) {
            <app-button type="button" impact="light" size="small" (buttonClick)="view.emit(null)">Dejar de ver</app-button>
            } @else {
            <app-button type="button" impact="light" size="small" (buttonClick)="view.emit(version)">Ver</app-button>
            }
            @if (canRestore()) {
            <app-button type="button" impact="bold" size="small" [isLoading]="restoringId() === version.id" [disabled]="restoringId() !== null" (buttonClick)="restore.emit(version)">
              Restaurar
            </app-button>
            }
          </div>
        </li>
        } @empty {
        <li class="text-muted-foreground py-8 text-center text-sm">Aún no hay versiones anteriores. Aparecerán cuando guardes cambios en el diseño.</li>
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

  protected date(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat('es-CL', { timeZone: safeZone(this.timeZone()), dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
}
