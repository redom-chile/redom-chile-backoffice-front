import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, IconComponent } from 'src/ui';
import { CreatedLocation, ServiceResult } from '../../../../data-access';

/** Paso final: resumen de lo creado y el atajo para tomar el primer pedido. */
@Component({
  selector: 'app-step-done',
  templateUrl: './step-done.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent],
})
export class StepDoneComponent {
  readonly #router = inject(Router);

  readonly businessName = input('');
  readonly location = input<CreatedLocation | null>(null);
  readonly service = input<ServiceResult | null>(null);
  readonly products = input<string[]>([]);

  readonly links = [
    { icon: 'tune', label: 'Completar datos del negocio', url: '/business' },
    { icon: 'restaurant_menu', label: 'Cargar tu carta', url: '/products' },
    { icon: 'group_add', label: 'Invitar a tu equipo', url: '/roles-and-permissions/users' },
  ];

  readonly $summary = computed(() => {
    const items: { icon: string; text: string }[] = [];
    const location = this.location();
    if (location) items.push({ icon: 'storefront', text: `Local "${location.name}"` });
    const service = this.service();
    if (service?.tablesCreated) {
      const tables = service.tablesCreated === 1 ? '1 mesa' : `${service.tablesCreated} mesas`;
      items.push({ icon: 'table_restaurant', text: service.sectorName ? `${tables} en ${service.sectorName}` : tables });
    } else if (service?.mode === 'counter') {
      items.push({ icon: 'point_of_sale', text: 'Atención en mostrador' });
    }
    const products = this.products();
    if (products.length) {
      items.push({ icon: 'restaurant_menu', text: products.length === 1 ? `1 producto: ${products[0]}` : `${products.length} productos` });
    }
    return items;
  });

  goTo(url: string) {
    this.#router.navigateByUrl(url);
  }
}
