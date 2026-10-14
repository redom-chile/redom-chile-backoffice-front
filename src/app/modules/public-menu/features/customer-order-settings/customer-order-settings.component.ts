import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService, PlanUpsellService, PublicPlansService } from 'src/app/core/services/entitlements';
import {
  getPublicMenuErrorMessage,
  MenuOrderingSettingsDto,
  MenuSettingsDto,
  MenuSettingsService,
  UpdateMenuSettingsDto,
} from 'src/app/modules/public-menu/data-access';
import { ButtonComponent, IconComponent, ToastService, ToggleComponent } from 'src/ui';
import { CustomerOrderOnlineSettingsComponent } from '../customer-order-online-settings';

type OrderingChanges = NonNullable<UpdateMenuSettingsDto['ordering']>;
type FlagKey = 'tableOrdering' | 'autoAccept' | 'tableRequests' | 'bookings';

const DEFAULT_ORDERING: MenuOrderingSettingsDto = {
  tableOrdering: false,
  autoAccept: false,
  maxOrderTotal: null,
  pickup: false,
  delivery: false,
  tableRequests: false,
  bookings: false,
};

const maxText = (value: number | null) => (value === null ? '' : String(value));

/** Sección Pedidos de la tarjeta del local: mesa, aceptación automática, total máximo, solicitudes, reservas, retiro y delivery. */
@Component({
  selector: 'app-customer-order-settings',
  imports: [ButtonComponent, IconComponent, ToggleComponent, CustomerOrderOnlineSettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let editable = $canEdit() && $hasFeature();
    <div class="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-foreground font-semibold">Pedidos</h3>
        @if (!$hasFeature()) {
        <span class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
          <app-icon class="h-3.5 w-3.5" aria-hidden="true">lock</app-icon>{{ $planBadge() }}
        </span>
        }
      </div>

      @if (!$hasFeature()) {
      <div class="glass-row flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-muted-foreground text-sm">Tus clientes piden desde el QR de su mesa y tú los aceptas o los mandas directo a cocina.</p>
        <app-button impact="light" size="small" type="button" icon="workspace_premium" (buttonClick)="upsell()">Ver planes</app-button>
      </div>
      }

      <div class="glass-row flex items-center justify-between gap-3 rounded-xl p-3">
        <div class="min-w-0">
          <p class="text-foreground text-sm font-medium">Pedidos desde la mesa</p>
          <p class="text-muted-foreground text-xs">Con el QR de la mesa, la carta muestra "Agregar" y el carrito.</p>
        </div>
        <app-toggle [checked]="$tableOrdering()" [disabled]="!editable || $busy() === 'tableOrdering'" (changed)="setFlag('tableOrdering', $event)" />
      </div>

      <div class="glass-row flex items-center justify-between gap-3 rounded-xl p-3">
        <div class="min-w-0">
          <p class="text-foreground text-sm font-medium">Aceptar automáticamente</p>
          <p class="text-muted-foreground text-xs">Los pedidos pasan directo a cocina, sin que nadie los acepte.</p>
        </div>
        <app-toggle [checked]="$autoAccept()" [disabled]="!editable || $busy() === 'autoAccept'" (changed)="setFlag('autoAccept', $event)" />
      </div>

      <div class="glass-row flex items-center justify-between gap-3 rounded-xl p-3">
        <div class="min-w-0">
          <p class="text-foreground text-sm font-medium">Llamar al mesero y pedir la cuenta</p>
          <p class="text-muted-foreground text-xs">Desde el QR de la mesa, el cliente llama al mesero o pide la cuenta con la propina sugerida.</p>
        </div>
        <app-toggle [checked]="$tableRequests()" [disabled]="!editable || $busy() === 'tableRequests'" (changed)="setFlag('tableRequests', $event)" />
      </div>

      <div class="glass-row flex items-center justify-between gap-3 rounded-xl p-3">
        <div class="min-w-0">
          <p class="text-foreground text-sm font-medium">Reservas desde la carta</p>
          <p class="text-muted-foreground text-xs">
            Tus clientes piden una reserva y tú la confirmas en Reservas.
            <span [class]="settings().isPublished ? '' : 'font-medium text-amber-700 dark:text-amber-300'">Para reservar, la carta tiene que estar publicada.</span>
          </p>
        </div>
        <app-toggle [checked]="$bookings()" [disabled]="!editable || $busy() === 'bookings'" (changed)="setFlag('bookings', $event)" />
      </div>

      <div class="glass-row flex flex-col gap-2 rounded-xl p-3">
        <label [for]="inputId()" class="text-foreground text-sm font-medium">Total máximo por pedido</label>
        <div class="flex flex-wrap items-start gap-2">
          <div class="relative w-full max-w-[12rem]">
            <span class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">$</span>
            <input
              [id]="inputId()"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              class="glass-input w-full rounded-md py-2 pl-6 pr-3 text-sm tabular-nums"
              placeholder="Sin límite"
              [class.border-red-500]="!!$maxError()"
              [value]="$maxText()"
              [disabled]="!editable"
              (input)="$maxText.set($any($event.target).value)"
              (keydown.enter)="saveMax()" />
          </div>
          @if (editable && $maxChanged()) {
          <app-button impact="light" size="small" type="button" [disabled]="$busy() === 'maxOrderTotal'" (buttonClick)="$maxText.set(savedMaxText())">Descartar</app-button>
          <app-button
            impact="bold"
            tone="primary"
            size="small"
            type="button"
            [disabled]="!!$maxError()"
            [isLoading]="$busy() === 'maxOrderTotal'"
            (buttonClick)="saveMax()">
            Guardar
          </app-button>
          }
        </div>
        @if ($maxError(); as error) {
        <p class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
        } @else {
        <p class="text-muted-foreground text-xs">Vacío, sin límite. Con IVA, en pesos.</p>
        }
      </div>

      <app-customer-order-online-settings [settings]="settings()" (changed)="changed.emit($event)" />
    </div>
  `,
})
export class CustomerOrderSettingsComponent {
  readonly #service = inject(MenuSettingsService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #plans = inject(PublicPlansService);
  readonly #upsell = inject(PlanUpsellService);

  readonly settings = input.required<MenuSettingsDto>();
  readonly changed = output<MenuSettingsDto[]>();

  readonly $ordering = computed(() => ({ ...DEFAULT_ORDERING, ...(this.settings().ordering ?? {}) }));
  readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));
  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('table_ordering'));
  readonly $planBadge = computed(() => {
    const name = this.#plans.planName(this.#plans.firstPlanWith(['table_ordering'])?.code);
    return name ? `Plan ${name}` : 'No incluido';
  });

  readonly inputId = computed(() => `menu-${this.settings().locationId}-max-order`);
  readonly $busy = signal<keyof OrderingChanges | null>(null);
  readonly $tableOrdering = linkedSignal(() => this.$ordering().tableOrdering);
  readonly $autoAccept = linkedSignal(() => this.$ordering().autoAccept);
  readonly $tableRequests = linkedSignal(() => !!this.$ordering().tableRequests);
  readonly $bookings = linkedSignal(() => !!this.$ordering().bookings);
  readonly savedMaxText = computed(() => maxText(this.$ordering().maxOrderTotal));
  readonly $maxText = linkedSignal(() => this.savedMaxText());

  readonly #maxValue = computed(() => {
    const text = this.$maxText().trim();
    return text === '' ? null : Number(text);
  });
  readonly $maxError = computed(() => {
    const value = this.#maxValue();
    if (value === null) return null;
    return Number.isInteger(value) && value >= 1 ? null : 'Usa un monto entero mayor a 0.';
  });
  readonly $maxChanged = computed(() => this.#maxValue() !== this.$ordering().maxOrderTotal);

  setFlag(key: FlagKey, value: boolean) {
    const targets = {
      tableOrdering: this.$tableOrdering,
      autoAccept: this.$autoAccept,
      tableRequests: this.$tableRequests,
      bookings: this.$bookings,
    };
    const target = targets[key];
    target.set(value);
    const messages: Record<FlagKey, string> = {
      tableOrdering: value ? 'Pedidos desde la mesa activados' : 'Pedidos desde la mesa desactivados',
      autoAccept: value ? 'Los pedidos pasarán directo a cocina' : 'Los pedidos esperarán que los aceptes',
      tableRequests: value ? 'Tus clientes ya pueden llamar al mesero y pedir la cuenta' : 'Llamar al mesero y pedir la cuenta desactivado',
      bookings: value
        ? this.settings().isPublished
          ? 'Reservas desde la carta activadas'
          : 'Reservas activadas: publica la carta para recibirlas'
        : 'Reservas desde la carta desactivadas',
    };
    this.#save(key, { [key]: value }, messages[key], () => target.set(!value));
  }

  saveMax() {
    if (!this.$maxChanged() || this.$maxError() || this.$busy()) return;
    const maxOrderTotal = this.#maxValue();
    this.#save('maxOrderTotal', { maxOrderTotal }, maxOrderTotal === null ? 'Pedidos sin total máximo' : 'Total máximo guardado');
  }

  upsell() {
    this.#upsell.open({ features: ['table_ordering'] });
  }

  #save(key: keyof OrderingChanges, ordering: OrderingChanges, message: string, rollback?: () => void) {
    if (this.$busy()) {
      rollback?.();
      return;
    }
    this.$busy.set(key);
    this.#service.update(this.settings().locationId, { ordering }).subscribe({
      next: (settings) => {
        this.$busy.set(null);
        this.#toast.show(message, 'success');
        this.changed.emit([settings]);
      },
      error: (error: unknown) => {
        this.$busy.set(null);
        rollback?.();
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo guardar el ajuste de pedidos.'), 'error');
      },
    });
  }
}
