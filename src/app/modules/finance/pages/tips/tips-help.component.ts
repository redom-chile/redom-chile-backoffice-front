import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from 'src/ui';
import { TIP_MODE_HINTS, TIP_MODE_LABELS } from '../../data-access';

/** Ayuda plegable de propinas. */
@Component({
  selector: 'app-tips-help',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="glass group mb-4 rounded-[1rem]">
      <summary class="text-foreground flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <app-icon class="text-primary h-5 w-5" aria-hidden="true">help_outline</app-icon>
        ¿Cómo funcionan las propinas?
        <app-icon class="text-muted-foreground ml-auto h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true">expand_more</app-icon>
      </summary>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-[var(--border)] px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-foreground font-medium">Son del equipo</dt>
          <dd class="text-muted-foreground">La propina que paga el cliente no es venta del local: se le debe al equipo hasta que se le paga.</dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Pendientes</dt>
          <dd class="text-muted-foreground">Cada propina cobrada queda pendiente hasta que la incluyes en una liquidación. El período usa la fecha del pago.</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-foreground font-medium">Modos de reparto</dt>
          <dd class="text-muted-foreground">
            <ul class="mt-1 list-disc space-y-0.5 pl-5">
              <li><strong>{{ labels.individual }}:</strong> {{ hints.individual }}</li>
              <li><strong>{{ labels.equal }}:</strong> {{ hints.equal }}</li>
              <li><strong>{{ labels.points }}:</strong> {{ hints.points }}</li>
            </ul>
            El modo por defecto se configura en Negocio › Punto de venta y se puede cambiar en cada liquidación.
          </dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Pago en efectivo</dt>
          <dd class="text-muted-foreground">Con la caja activa, el efectivo sale del turno abierto del local y queda en su reporte Z.</dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Anular una liquidación</dt>
          <dd class="text-muted-foreground">Las propinas vuelven a quedar pendientes y, si se pagó en efectivo, el dinero vuelve a la caja (debe estar abierta).</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-foreground font-medium">Pagos con propina liquidada</dt>
          <dd class="text-muted-foreground">Un pago cuya propina ya se liquidó no se puede anular hasta anular primero esa liquidación.</dd>
        </div>
      </dl>
    </details>
  `,
})
export class TipsHelpComponent {
  readonly labels = TIP_MODE_LABELS;
  readonly hints = TIP_MODE_HINTS;
}
