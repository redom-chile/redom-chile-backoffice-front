import { inject, Injectable, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PlanFeatureCode, PlanLimitCode, LockableResource } from './dtos';

/** Qué gatilló el modal: funciones que faltan, un límite lleno o un recurso en solo lectura. */
export type PlanUpsellData = Readonly<{
  features?: PlanFeatureCode[];
  limit?: PlanLimitCode;
  max?: number;
  used?: number;
  resource?: LockableResource;
  /** Del error del backend; si no viene, se calcula con los planes públicos. */
  requiredPlans?: string[];
}>;

/** Abre el modal "Disponible desde el plan X" (uno a la vez). */
@Injectable({ providedIn: 'root' })
export class PlanUpsellService {
  readonly #injector = inject(Injector);
  #open = false;

  open(data: PlanUpsellData) {
    if (this.#open) return;
    this.#open = true;
    // Import diferido: el modal vive en el módulo billing y no debe cargarse con el core.
    import('src/app/modules/billing/features/plan-upsell-modal').then(({ PlanUpsellModalComponent }) => {
      this.#injector
        .get(MatDialog)
        .open(PlanUpsellModalComponent, { width: '440px', maxWidth: '95vw', data, autoFocus: 'dialog' })
        .afterClosed()
        .subscribe(() => (this.#open = false));
    });
  }
}
