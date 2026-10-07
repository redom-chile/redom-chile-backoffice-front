import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from 'src/ui';
import { KitchenOrderDto } from '../../data-access';

// Minutos a partir de los cuales la comanda se marca como demorada.
const WARNING_MINUTES = 10;
const LATE_MINUTES = 20;

@Component({
  selector: 'app-kitchen-ticket',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './kitchen-ticket.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KitchenTicketComponent {
  readonly order = input.required<KitchenOrderDto>();
  // Reloj compartido de la pantalla, para que todas las comandas avancen juntas.
  readonly now = input.required<number>();
  readonly busy = input(false);

  readonly markReady = output<KitchenOrderDto>();

  readonly $minutes = computed(() =>
    Math.max(0, Math.floor((this.now() - new Date(this.order().orderDate).getTime()) / 60000)),
  );
  readonly $tone = computed(() =>
    this.$minutes() >= LATE_MINUTES ? 'late' : this.$minutes() >= WARNING_MINUTES ? 'warning' : 'ok',
  );
  readonly $elapsed = computed(() => {
    const minutes = this.$minutes();
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  });
  // Notas del pedido para toda la comanda (se omiten las vacías y las repetidas).
  readonly $orderNotes = computed(() => {
    const notes = [this.order().staffNote, this.order().additionalNotes]
      .map((note) => note?.trim() ?? '')
      .filter((note) => note.length > 0);
    return [...new Set(notes)];
  });
  readonly $itemCount = computed(() => this.order().lineOrders.reduce((sum, line) => sum + line.quantity, 0));

  // null o "DUMMY": producto sin variaciones reales, no se muestra.
  variationLabel(name: string | null): string | null {
    return name && name !== 'DUMMY' ? name : null;
  }
}
