import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { CartaMenuView } from 'src/app/modules/public-menu/carta/ui/carta-menu-view';
import { PublicLocationMenuDto } from 'src/app/modules/public-menu/data-access';
import { IconComponent, SkeletonComponent } from 'src/ui';

/** Celular con la carta real (CartaMenuView en modo vista previa) y cambio claro/oscuro. */
@Component({
  selector: 'app-menu-design-preview',
  imports: [CartaMenuView, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-2 flex items-center justify-between gap-2">
      <p class="text-muted-foreground truncate text-xs font-medium uppercase tracking-wide">Vista previa{{ locationName() ? ' · ' + locationName() : '' }}</p>
      <div class="glass-input inline-flex shrink-0 rounded-full p-0.5" role="group" aria-label="Modo de la vista previa">
        @for (mode of modes; track mode.dark) {
        <button
          type="button"
          class="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium"
          [class]="dark() === mode.dark ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
          [attr.aria-pressed]="dark() === mode.dark"
          (click)="dark.set(mode.dark)">
          <app-icon class="h-3.5 w-3.5" aria-hidden="true">{{ mode.icon }}</app-icon>{{ mode.label }}
        </button>
        }
      </div>
    </div>
    <ng-content />
    <div class="mx-auto w-full max-w-[390px] rounded-[2.25rem] border-[7px] border-neutral-800 bg-neutral-800 shadow-xl dark:border-neutral-700">
      <!-- Contenedor de desplazamiento de la carta; transform: lo fijo (position: fixed) queda dentro del celular -->
      <div
        class="bg-background text-foreground relative h-[min(760px,calc(100dvh-14rem))] min-h-[420px] overflow-y-auto overflow-x-hidden overscroll-contain rounded-[1.75rem] [transform:translateZ(0)]"
        tabindex="0"
        aria-label="Vista previa de la carta">
        @if (menu(); as m) {
        <app-carta-menu-view [menu]="m" [preview]="true" [previewDark]="dark()" />
        } @else if (loading()) {
        <div class="space-y-3 p-4">
          <app-skeleton size="lg" style="width: 100%" />
          <app-skeleton size="sm" style="width: 60%" />
          <app-skeleton size="sm" style="width: 80%" />
          <app-skeleton size="sm" style="width: 70%" />
        </div>
        } @else {
        <div class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <app-icon class="text-muted-foreground h-10 w-10" aria-hidden="true">phone_iphone</app-icon>
          <p class="text-muted-foreground text-sm">{{ message() || 'No se pudo cargar la carta del local.' }}</p>
        </div>
        }
      </div>
    </div>
  `,
})
export class MenuDesignPreviewComponent {
  readonly menu = input<PublicLocationMenuDto | null>(null);
  readonly loading = input(false);
  /** Por qué no hay carta para mostrar. */
  readonly message = input<string | null>(null);
  readonly locationName = input('');

  protected readonly modes = [
    { dark: false, label: 'Claro', icon: 'light_mode' },
    { dark: true, label: 'Oscuro', icon: 'dark_mode' },
  ] as const;
  readonly dark = signal(false);
}
