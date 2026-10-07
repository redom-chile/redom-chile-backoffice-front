import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { IconComponent } from 'src/ui';
import { DocumentListComponent } from '../../shared';

/** Producciones de preparaciones (documentos type=production) con filtros de local y fechas. */
@Component({
  selector: 'app-production-list',
  imports: [RouterLink, IconComponent, DocumentListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ($ingredientsDisabled()) {
    <div class="glass mb-4 flex flex-col gap-3 rounded-[1rem] p-4 sm:flex-row sm:items-center">
      <app-icon class="text-primary h-6 w-6 shrink-0" aria-hidden="true">soup_kitchen</app-icon>
      <div class="min-w-0 flex-1">
        <p class="text-foreground text-sm font-semibold">Las recetas no están activadas</p>
        <p class="text-muted-foreground text-sm">
          Para producir preparaciones activa "Trabajar con ingredientes y recetas" en la configuración de inventario.
        </p>
      </div>
      <a
        routerLink="/business"
        [queryParams]="{ tab: 'inventario' }"
        class="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline">
        Ir a la configuración
        <app-icon class="h-4 w-4">arrow_forward</app-icon>
      </a>
    </div>
    }

    <app-document-list type="production" />

    <!-- Ayuda -->
    <details class="glass mt-4 rounded-[1rem] p-4 text-sm">
      <summary class="text-foreground cursor-pointer font-medium">¿Cómo funciona la producción?</summary>
      <ul class="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
        <li>
          Una <strong>preparación</strong> es un ingrediente que se elabora en el local (salsas, masas, caldos). Su receta es por
          tanda e indica cuánto rinde. Ármala en
          <a routerLink="/inventory/recipes" [queryParams]="{ tab: 'preparaciones' }" class="text-primary font-medium hover:underline">
            Recetas → Preparaciones</a>.
        </li>
        <li>
          Al <strong>producir</strong> se consumen sus ingredientes en proporción: producir 1 l con una receta que rinde 2 l usa
          media tanda. La preparación entra al stock al costo de lo consumido.
        </li>
        <li>Al vender, los platos que usan la preparación la descuentan a ella, no a sus ingredientes.</li>
        <li>Puedes indicar lote y vencimiento de lo producido para las alertas de vencimiento.</li>
      </ul>
    </details>
  `,
})
export class ProductionListComponent {
  readonly #settings = inject(BusinessSettingsService);

  readonly $ingredientsDisabled = computed(
    () => this.#settings.$isLoaded() && this.#settings.$inventoryEnabled() && !this.#settings.$ingredientsEnabled(),
  );
}
