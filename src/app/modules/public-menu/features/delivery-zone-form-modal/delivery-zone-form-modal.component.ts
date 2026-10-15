import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import {
  CommuneRefDto,
  CustomerOrdersService,
  DeliveryZoneDto,
  getPublicMenuErrorMessage,
  SaveDeliveryZoneDto,
} from 'src/app/modules/public-menu/data-access';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService, ToggleComponent } from 'src/ui';
import { CommunePickerComponent } from './commune-picker.component';

export type DeliveryZoneFormData = Readonly<{ locationId: number; zone?: DeliveryZoneDto; hasCoordinates: boolean }>;

type Field = 'name' | 'area' | 'radiusKm' | 'fee' | 'minOrder' | 'etaMinutes';

const NAME_MAX = 80;
const DEFAULT_ETA = 45;

const toNumber = (text: string) => {
  const clean = text.trim().replace(',', '.');
  return clean === '' ? null : Number(clean);
};
const twoDecimals = (value: number) => Math.round(value * 100) === value * 100;

/** Crear o editar una zona de reparto: comunas o radio, costo de envío, mínimo y tiempo estimado. */
@Component({
  selector: 'app-delivery-zone-form-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective, ToggleComponent, CommunePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let errors = $visibleErrors();
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ data.zone ? 'Editar zona' : 'Nueva zona de reparto' }}</h2>
      </ng-template>

      <div class="space-y-4 p-2">
        <div>
          <label for="zone-name" class="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            id="zone-name"
            type="text"
            autocomplete="off"
            class="glass-input w-full rounded-md px-3 py-2 text-sm"
            placeholder="Providencia y Ñuñoa"
            [class.border-red-500]="!!errors.name"
            [value]="$name()"
            (input)="$name.set($any($event.target).value)" />
          @if (errors.name; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
        </div>

        <div>
          <p class="mb-1 text-sm font-medium">Comunas</p>
          <app-commune-picker [(selected)]="$communes" />
        </div>

        <div>
          <label for="zone-radius" class="mb-1 block text-sm font-medium">Radio desde el local</label>
          <div class="relative w-full max-w-[10rem]">
            <input
              id="zone-radius"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              inputmode="decimal"
              class="glass-input w-full rounded-md py-2 pl-3 pr-10 text-sm tabular-nums"
              placeholder="Opcional"
              [class.border-red-500]="!!errors.radiusKm"
              [value]="$radius()"
              (input)="$radius.set($any($event.target).value)" />
            <span class="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">km</span>
          </div>
          @if (errors.radiusKm; as error) {
          <p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
          } @else if (!data.hasCoordinates && $radius().trim()) {
          <p class="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">El local no tiene latitud y longitud guardadas: el radio no aplica hasta que las completes.</p>
          } @else {
          <p class="text-muted-foreground mt-1 text-xs">De 0,1 a 100 km, en línea recta desde el local.</p>
          }
        </div>
        @if (errors.area; as error) {
        <p class="-mt-2 text-xs font-medium text-red-600 dark:text-red-400" role="alert">{{ error }}</p>
        }

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label for="zone-fee" class="mb-1 block text-sm font-medium">Costo de envío</label>
            <div class="relative">
              <span class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">$</span>
              <input id="zone-fee" type="number" min="0" step="1" inputmode="numeric" class="glass-input w-full rounded-md py-2 pl-6 pr-3 text-sm tabular-nums"
                placeholder="0" [class.border-red-500]="!!errors.fee" [value]="$fee()" (input)="$fee.set($any($event.target).value)" />
            </div>
            @if (errors.fee; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
          </div>
          <div>
            <label for="zone-min" class="mb-1 block text-sm font-medium">Pedido mínimo</label>
            <div class="relative">
              <span class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">$</span>
              <input id="zone-min" type="number" min="0" step="1" inputmode="numeric" class="glass-input w-full rounded-md py-2 pl-6 pr-3 text-sm tabular-nums"
                placeholder="0" [class.border-red-500]="!!errors.minOrder" [value]="$minOrder()" (input)="$minOrder.set($any($event.target).value)" />
            </div>
            @if (errors.minOrder; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
          </div>
          <div>
            <label for="zone-eta" class="mb-1 block text-sm font-medium">Tiempo estimado</label>
            <div class="relative">
              <input id="zone-eta" type="number" min="5" max="300" step="1" inputmode="numeric" class="glass-input w-full rounded-md py-2 pl-3 pr-12 text-sm tabular-nums"
                [class.border-red-500]="!!errors.etaMinutes" [value]="$eta()" (input)="$eta.set($any($event.target).value)" />
              <span class="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">min</span>
            </div>
            @if (errors.etaMinutes; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
          </div>
        </div>
        <p class="text-muted-foreground -mt-2 text-xs">Montos con IVA. El mínimo se calcula sobre los productos, sin el envío.</p>

        <div class="glass-row flex items-center justify-between gap-3 rounded-xl p-3">
          <div>
            <p class="text-sm font-medium">Activa</p>
            <p class="text-muted-foreground text-xs">Inactiva, no se ofrece en la carta.</p>
          </div>
          <app-toggle [checked]="$isActive()" (changed)="$isActive.set($event)" />
        </div>
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-2">
          <app-button type="button" impact="light" tone="primary" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" tone="primary" [isLoading]="$isSaving()" (buttonClick)="submit()">
            {{ data.zone ? 'Guardar' : 'Crear zona' }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class DeliveryZoneFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<DeliveryZoneFormModalComponent, DeliveryZoneDto>>(MatDialogRef);
  readonly data = inject<DeliveryZoneFormData>(MAT_DIALOG_DATA);
  readonly #service = inject(CustomerOrdersService);
  readonly #toast = inject(ToastService);

  readonly $name = signal(this.data.zone?.name ?? '');
  readonly $communes = signal<CommuneRefDto[]>([...(this.data.zone?.communes ?? [])]);
  readonly $radius = signal(this.data.zone?.radiusKm != null ? String(Number(this.data.zone.radiusKm)) : '');
  readonly $fee = signal(this.data.zone ? String(Number(this.data.zone.fee)) : '');
  readonly $minOrder = signal(this.data.zone ? String(Number(this.data.zone.minOrder)) : '');
  readonly $eta = signal(String(this.data.zone?.etaMinutes ?? DEFAULT_ETA));
  readonly $isActive = signal(this.data.zone?.isActive ?? true);
  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);

  readonly $errors = computed(() => {
    const errors: Partial<Record<Field, string>> = {};
    const name = this.$name().trim();
    if (!name) errors.name = 'Escribe un nombre.';
    else if (name.length > NAME_MAX) errors.name = `Máximo ${NAME_MAX} caracteres.`;
    const radius = toNumber(this.$radius());
    if (radius !== null && (!Number.isFinite(radius) || radius < 0.1 || radius > 100 || !twoDecimals(radius))) errors.radiusKm = 'De 0,1 a 100 km.';
    if (!this.$communes().length && radius === null) errors.area = 'Elige al menos una comuna o indica un radio.';
    for (const field of ['fee', 'minOrder'] as const) {
      const value = toNumber(field === 'fee' ? this.$fee() : this.$minOrder());
      if (value !== null && (!Number.isFinite(value) || value < 0 || !twoDecimals(value))) errors[field] = 'Usa un monto de 0 o más.';
    }
    const eta = toNumber(this.$eta());
    if (eta === null || !Number.isInteger(eta) || eta < 5 || eta > 300) errors.etaMinutes = 'De 5 a 300 min.';
    return errors;
  });
  readonly $visibleErrors = computed<Partial<Record<Field, string>>>(() => (this.$submitted() ? this.$errors() : {}));

  submit() {
    this.$submitted.set(true);
    if (Object.keys(this.$errors()).length || this.$isSaving()) return;
    const body: SaveDeliveryZoneDto = {
      name: this.$name().trim(),
      communeIds: this.$communes().map((commune) => commune.id),
      radiusKm: toNumber(this.$radius()),
      fee: toNumber(this.$fee()) ?? 0,
      minOrder: toNumber(this.$minOrder()) ?? 0,
      etaMinutes: toNumber(this.$eta()) ?? DEFAULT_ETA,
      isActive: this.$isActive(),
    };
    const zone = this.data.zone;
    this.$isSaving.set(true);
    const request = zone ? this.#service.updateDeliveryZone(zone.id, body) : this.#service.createDeliveryZone({ ...body, locationId: this.data.locationId });
    request.subscribe({
      next: (saved) => {
        this.#toast.show(zone ? 'Zona guardada' : 'Zona creada', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo guardar la zona. Revisa las comunas y el radio.'), 'error');
      },
    });
  }
}

export function openDeliveryZoneFormModal(dialog: MatDialog, data: DeliveryZoneFormData): Observable<DeliveryZoneDto | undefined> {
  return dialog
    .open<DeliveryZoneFormModalComponent, DeliveryZoneFormData, DeliveryZoneDto>(DeliveryZoneFormModalComponent, {
      width: '560px',
      maxWidth: '95vw',
      autoFocus: false,
      data,
    })
    .afterClosed();
}
