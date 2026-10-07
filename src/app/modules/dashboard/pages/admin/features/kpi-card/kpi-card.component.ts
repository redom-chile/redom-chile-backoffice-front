import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { IconComponent } from 'src/ui';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [IconComponent, RouterLink, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass-tile-soft flex h-full flex-col gap-2 rounded-2xl p-4">
      <div class="flex items-center justify-between gap-2">
        <p class="text-muted-foreground text-sm">{{ label() }}</p>
        <!-- Explicación del indicador: mouse, teclado (Tab) o mantener presionado en el teléfono. -->
        <span
          class="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          [class.cursor-help]="info()"
          [matTooltip]="info()"
          [matTooltipDisabled]="!info()"
          matTooltipPosition="above"
          matTooltipClass="redom-tooltip"
          [attr.tabindex]="info() ? 0 : null"
          [attr.role]="info() ? 'img' : null"
          [attr.aria-label]="info() ? label() + ': ' + info() : null">
          <app-icon class="h-5 w-5">{{ icon() }}</app-icon>
        </span>
      </div>
      <p class="text-foreground text-2xl font-bold tabular-nums">{{ value() }}</p>
      @if ($delta(); as delta) {
      <p class="flex items-center gap-1 text-xs">
        <span class="inline-flex items-center font-semibold" [class]="delta.tone">
          <app-icon class="h-4 w-4">{{ delta.icon }}</app-icon>{{ delta.text }}
        </span>
        <span class="text-muted-foreground">{{ comparison() }}</span>
      </p>
      } @else if (hint()) {
      <p class="text-muted-foreground text-xs">{{ hint() }}</p>
      }
      @if (link()) {
      <a [routerLink]="link()" class="text-primary mt-auto text-xs font-medium hover:underline">{{ linkLabel() }}</a>
      }
    </div>
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly icon = input('insights');
  // Valores numéricos para calcular la variación contra el período anterior.
  readonly current = input<number | null>(null);
  readonly previous = input<number | null>(null);
  readonly comparison = input('');
  readonly hint = input('');
  // Qué muestra el indicador (tooltip del ícono).
  readonly info = input('');
  readonly link = input<string | null>(null);
  readonly linkLabel = input('Ver');

  readonly $delta = computed(() => {
    const current = this.current();
    const previous = this.previous();
    if (current === null || previous === null) return null;
    if (previous === 0) return current === 0 ? null : { text: 'Nuevo', icon: 'trending_up', tone: 'text-green-600' };
    const change = ((current - previous) / previous) * 100;
    const rounded = Math.round(change);
    if (rounded === 0) return { text: '0%', icon: 'trending_flat', tone: 'text-muted-foreground' };
    return rounded > 0
      ? { text: `+${rounded}%`, icon: 'trending_up', tone: 'text-green-600' }
      : { text: `${rounded}%`, icon: 'trending_down', tone: 'text-red-600' };
  });
}
