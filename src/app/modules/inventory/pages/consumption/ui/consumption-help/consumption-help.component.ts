import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Ayuda plegable: qué es el consumo teórico, el real y la variación. */
@Component({
  selector: 'app-consumption-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="glass rounded-[1rem] p-4 text-sm">
      <summary class="text-foreground cursor-pointer font-medium">¿Cómo se calcula este reporte?</summary>
      <ul class="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
        <li><strong>Consumo teórico:</strong> lo que las ventas debieron consumir según las recetas (y los productos con stock propio vendidos).</li>
        <li><strong>Consumo real:</strong> teórico + mermas + faltantes del conteo.</li>
        <li>
          <strong>Variación</strong> (real − teórico): lo que se perdió por mermas, robos o porciones mal servidas. Si es negativa, el conteo encontró más
          stock del esperado.
        </li>
        <li>Los valores usan el costo promedio del local. Las cantidades se muestran en la unidad base de cada ítem.</li>
        <li>El período considera la fecha en que se registró cada movimiento, no la fecha del documento.</li>
        <li>Para ver la variación completa, haz un conteo físico al final del período.</li>
      </ul>
    </details>
  `,
})
export class ConsumptionHelpComponent {}
