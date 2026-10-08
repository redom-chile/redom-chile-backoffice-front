import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from 'src/ui';

/** Ayuda plegable de cuentas por pagar. */
@Component({
  selector: 'app-payables-help',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="glass group mb-4 rounded-[1rem]">
      <summary class="text-foreground flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <app-icon class="text-primary h-5 w-5" aria-hidden="true">help_outline</app-icon>
        ¿Cómo funcionan las cuentas por pagar?
        <app-icon class="text-muted-foreground ml-auto h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true">expand_more</app-icon>
      </summary>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-[var(--border)] px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-foreground font-medium">Qué aparece aquí</dt>
          <dd class="text-muted-foreground">Gastos y compras a proveedores con saldo pendiente. Los gastos recurrentes del período se crean solos al entrar.</dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Vencimiento</dt>
          <dd class="text-muted-foreground">Fecha del documento + condiciones de pago del proveedor (sin condiciones, el mismo día). Pasada esa fecha queda vencida.</dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Estados</dt>
          <dd class="text-muted-foreground">Pendiente: sin pagos. Parcial: tiene abonos y aún queda saldo. Al pagarse completa sale de esta lista.</dd>
        </div>
        <div>
          <dt class="text-foreground font-medium">Pagos en efectivo</dt>
          <dd class="text-muted-foreground">Con la caja activa, el efectivo sale del turno abierto del local. Si anulas el pago, vuelve a la caja.</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-foreground font-medium">Compras antiguas</dt>
          <dd class="text-muted-foreground">Las compras registradas antes de activar las cuentas por pagar quedaron como pagadas y no aparecen aquí.</dd>
        </div>
      </dl>
    </details>
  `,
})
export class PayablesHelpComponent {}
