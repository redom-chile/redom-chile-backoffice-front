import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from 'src/ui';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { isPackLine, OrderDetailDto, OrderLineDto, OrderLineModifierDto, packItemLabel } from 'src/app/modules/orders/pages/order-detail/data-access';
import { CartLine, CartNoteChange, CustomerSelectorComponent, modifierLabel, OrderTicketComponent } from 'src/app/modules/orders/pages/order-create/features';
import { CustomerDto } from 'src/app/modules/orders/pages/order-create/data-access';
import { formatCurrency, KITCHEN_STATUS, StatusBadgeComponent } from 'src/app/modules/orders/pages/order-list/ui';
import { LoyaltyRedeemButtonComponent } from 'src/app/modules/loyalty/features/loyalty-redeem';

@Component({
  selector: 'app-pos-order-panel',
  standalone: true,
  imports: [RouterLink, IconComponent, OrderTicketComponent, CustomerSelectorComponent, StatusBadgeComponent, LoyaltyRedeemButtonComponent],
  templateUrl: './pos-order-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosOrderPanelComponent {
  readonly title = input.required<string>();
  // Cuenta abierta de la mesa (null = pedido nuevo).
  readonly order = input<OrderDetailDto | null>(null);
  readonly loadingOrder = input(false);
  readonly cart = input.required<CartLine[]>();
  readonly customer = input<CustomerDto | null>(null);
  readonly sendToKitchen = input(true);
  readonly saving = input(false);
  readonly kitchenNote = input('');

  readonly increment = output<string>();
  readonly decrement = output<string>();
  readonly remove = output<string>();
  readonly noteChange = output<CartNoteChange>();
  readonly edit = output<string>();
  readonly kitchenNoteChange = output<string>();
  readonly customerChange = output<CustomerDto | null>();
  readonly sendToKitchenChange = output<boolean>();
  readonly submitOrder = output<void>();
  readonly collect = output<void>();
  // Canje de fidelización: hay que recargar la cuenta.
  readonly loyaltyRedeemed = output<void>();
  // Asignar o cambiar el cliente de la cuenta abierta.
  readonly orderCustomerChange = output<CustomerDto | null>();
  readonly savingCustomer = input(false);

  // El detalle solo trae id y nombre del cliente.
  readonly $orderCustomer = computed<CustomerDto | null>(() => {
    const order = this.order();
    return order?.contactId ? { id: order.contactId, name: order.customerName ?? 'Cliente', mobile: '', email: null } : null;
  });
  readonly $canEditOrder = computed(() => this.access.can(PERMISSIONS.ORDERS.UPDATE_ORDER));

  private readonly access = inject(AccessService);

  // Con cuenta abierta se agregan líneas (actualiza el pedido); sin ella se crea.
  readonly $canSubmit = computed(() =>
    this.access.can(this.order() ? PERMISSIONS.ORDERS.UPDATE_ORDER : PERMISSIONS.ORDERS.CREATE_ORDER),
  );
  readonly $canCollect = computed(() => this.access.can(PERMISSIONS.PAYMENTS.CREATE_PAYMENT));

  readonly kitchenStatus = KITCHEN_STATUS;
  readonly formatCurrency = formatCurrency;
  readonly packItemLabel = packItemLabel;
  readonly isPackLine = isPackLine;

  // 'DUMMY' es la variación única de los productos sin variaciones.
  variationLabel(line: OrderLineDto): string | null {
    return line.variationName && line.variationName !== 'DUMMY' ? line.variationName : null;
  }

  // El backend envía el total (cantidad × veces); se muestran las veces por unidad.
  lineModifierLabel(line: OrderLineDto, mod: OrderLineModifierDto): string {
    const times = line.quantity > 0 ? Math.round(mod.quantity / line.quantity) : mod.quantity;
    return modifierLabel(mod.name, times);
  }
}
