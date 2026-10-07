import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from 'src/ui';

/** Ayuda plegable con los conceptos de caja y turnos. */
@Component({
  selector: 'app-cash-concepts',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="glass group mb-4 rounded-[1rem]">
      <summary class="text-foreground flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <app-icon class="text-primary h-5 w-5" aria-hidden="true">help_outline</app-icon>
        ¿Cómo funciona la caja?
        <app-icon class="text-muted-foreground ml-auto h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true">expand_more</app-icon>
      </summary>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-[var(--border)] px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-foreground font-medium">Caja</dt>
          <dd class="text-muted-foreground">El cajón de un local. Cada local trae una "Caja principal"; puedes crear más (barra, salón).</dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Turno</dt>
          <dd class="text-muted-foreground">Se abre con un fondo inicial y se cierra contando la plata. Una caja tiene a lo más un turno abierto.</dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Efectivo esperado</dt>
          <dd class="text-muted-foreground">Fondo + cobros en efectivo (con propina, ya descontado el vuelto) − devoluciones + ingresos − retiros.</dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Arqueo ciego</dt>
          <dd class="text-muted-foreground">
            Quien cierra cuenta sin ver lo esperado. La diferencia la calcula el sistema:
            <span class="text-red-600 dark:text-red-400">negativa = faltante</span>,
            <span class="text-green-600 dark:text-green-400">positiva = sobrante</span>.
          </dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Propinas</dt>
          <dd class="text-muted-foreground">Están en la caja, pero se le deben al equipo: el reporte las muestra aparte.</dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Turno cerrado</dt>
          <dd class="text-muted-foreground">No cambia nunca. Si se anula un pago de un turno cerrado, la devolución sale del turno abierto ahora en esa caja.</dd>
        </div>
      </dl>
    </details>
  `,
})
export class CashConceptsComponent {}
