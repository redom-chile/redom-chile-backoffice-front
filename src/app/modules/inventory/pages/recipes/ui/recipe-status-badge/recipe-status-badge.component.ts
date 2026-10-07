import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RecipeStatus } from '../../data-access';

type Badge = Readonly<{ label: string; tone: 'muted' | 'ok' | 'warn' | 'error' }>;

const TONES: Record<Badge['tone'], string> = {
  muted: 'bg-gray-500/15 text-gray-600 dark:text-gray-300',
  ok: 'bg-green-500/15 text-green-700 dark:text-green-400',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  error: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

/** "Con receta" / "Sin receta" de un plato, o cuántas opciones de un set tienen receta. */
@Component({
  selector: 'app-recipe-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let badge = $badge();
    <span class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium" [class]="tones[badge.tone]">
      {{ badge.label }}
    </span>
  `,
})
export class RecipeStatusBadgeComponent {
  readonly status = input<RecipeStatus | undefined>(undefined);
  // Set de modificadores: que una opción no tenga receta es normal ("Punto de cocción").
  readonly isModifier = input(false);

  protected readonly tones = TONES;

  protected readonly $badge = computed<Badge>(() => {
    const status = this.status();
    if (!status || status.kind === 'loading') return { label: 'Revisando…', tone: 'muted' };
    if (status.kind === 'error') return { label: 'No se pudo revisar', tone: 'error' };
    const { withRecipe, total } = status;
    if (this.isModifier()) {
      if (!withRecipe) return { label: 'Ninguna opción con receta', tone: 'muted' };
      return { label: `${withRecipe} de ${total} ${total === 1 ? 'opción' : 'opciones'} con receta`, tone: 'ok' };
    }
    if (total > 0 && withRecipe === total) return { label: 'Con receta', tone: 'ok' };
    if (!withRecipe) return { label: 'Sin receta', tone: 'warn' };
    return { label: `Receta en ${withRecipe} de ${total}`, tone: 'warn' };
  });
}
