import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BusinessSettingsService, InventorySettings, StockDeductionMoment, UpdateInventorySettingsDto } from 'src/app/core/services/business-settings';
import { getInventoryErrorMessage } from 'src/app/modules/inventory/data-access';
import {
  ButtonComponent,
  CardComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  IconComponent,
  SkeletonComponent,
  ToastService,
  ToggleComponent,
} from 'src/ui';

type InventorySettingKey = keyof InventorySettings;

const SUCCESS_MESSAGES: Partial<Record<InventorySettingKey, [on: string, off: string]>> = {
  inventoryEnabled: ['Inventario activado', 'Inventario desactivado'],
  ingredientsEnabled: ['Ingredientes y recetas activados', 'Ingredientes y recetas desactivados'],
  deductStockOnSale: ['Descuento de stock al vender activado', 'Descuento de stock al vender desactivado'],
  allowNegativeStock: ['Ahora se permite stock negativo', 'Ya no se permite stock negativo'],
};

export const STOCK_DEDUCTION_MOMENT_OPTIONS: ReadonlyArray<{ value: StockDeductionMoment; label: string }> = [
  { value: 'on_order', label: 'Al ingresar el pedido' },
  { value: 'on_payment', label: 'Al pagar' },
];

/**
 * Pestaña "Inventario" de Mi negocio. Cada cambio se guarda al momento (igual que el estado y el color
 * del negocio): mientras guarda, los controles quedan deshabilitados y si falla se vuelve al valor anterior.
 */
@Component({
  selector: 'app-inventory-settings',
  imports: [RouterLink, CardComponent, ToggleComponent, IconComponent, ButtonComponent, SkeletonComponent],
  templateUrl: './inventory-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventorySettingsComponent {
  readonly #settingsService = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);
  readonly #dialog = inject(MatDialog);

  readonly deductionMoments = STOCK_DEDUCTION_MOMENT_OPTIONS;
  readonly $isLoaded = this.#settingsService.$isLoaded;
  readonly $isLoading = this.#settingsService.$isLoading;
  readonly $hasError = this.#settingsService.$hasError;

  // Valores aún no confirmados por el backend. Al limpiarlos, los controles vuelven al valor guardado.
  readonly #draft = signal<UpdateInventorySettingsDto>({});
  readonly $isSaving = signal(false);
  // El inventario se activó en esta visita: se sugieren los primeros pasos.
  readonly $justEnabled = signal(false);

  readonly $view = computed<InventorySettings>(() => ({ ...this.#settingsService.$inventory(), ...this.#draft() }));

  retry() {
    this.#settingsService.reload();
  }

  toggle(key: InventorySettingKey, value: boolean) {
    if (key === 'inventoryEnabled' && !value) {
      this.#confirmDisableInventory();
      return;
    }
    this.#save({ [key]: value }, key, value);
  }

  changeMoment(event: Event) {
    const value = (event.target as HTMLSelectElement).value as StockDeductionMoment;
    this.#save({ stockDeductionMoment: value }, 'stockDeductionMoment', value);
  }

  // Apagar el inventario con "descontar" o "ingredientes" activos da 400: se apagan en el mismo PATCH.
  #confirmDisableInventory() {
    const current = this.$view();
    const changes: UpdateInventorySettingsDto = {
      inventoryEnabled: false,
      ...(current.deductStockOnSale ? { deductStockOnSale: false } : {}),
      ...(current.ingredientsEnabled ? { ingredientsEnabled: false } : {}),
    };
    // El switch ya se ve apagado: se refleja en el borrador mientras se confirma.
    this.#draft.set(changes);
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Desactivar inventario',
          message:
            'Se ocultará el menú Inventario y se apagarán "Descontar stock al vender" e "Ingredientes y recetas". El stock y los movimientos registrados no se borran.',
          confirmText: 'Desactivar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          this.#draft.set({});
          return;
        }
        this.#save(changes, 'inventoryEnabled', false);
      });
  }

  #save(changes: UpdateInventorySettingsDto, key: InventorySettingKey, value: boolean | string) {
    const wasEnabled = this.#settingsService.$inventory().inventoryEnabled;
    this.#draft.set(changes);
    this.$isSaving.set(true);
    this.#settingsService.updateInventory(changes).subscribe({
      next: () => {
        this.#draft.set({});
        this.$isSaving.set(false);
        if (key === 'inventoryEnabled') this.$justEnabled.set(value === true && !wasEnabled);
        const messages = SUCCESS_MESSAGES[key];
        this.#toast.show(messages ? messages[value ? 0 : 1] : 'Configuración guardada', 'success');
      },
      error: (error) => {
        this.#draft.set({});
        this.$isSaving.set(false);
        this.#toast.show(getInventoryErrorMessage(error, 'No se pudo guardar la configuración.'), 'error');
      },
    });
  }
}
