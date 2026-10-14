import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService, PlanUpsellService, PublicPlansService } from 'src/app/core/services/entitlements';
import {
  BankAccountDto,
  getPublicMenuErrorMessage,
  MenuSettingsDto,
  MenuSettingsService,
  OnlinePaymentMethod,
  UpdateMenuSettingsDto,
} from 'src/app/modules/public-menu/data-access';
import { DeliveryZoneListComponent } from 'src/app/modules/public-menu/features/delivery-zone-list';
import { formatRut, isValidRut } from 'src/app/shared/validators';
import { ButtonComponent, IconComponent, ToastService, ToggleComponent } from 'src/ui';

type OrderingChanges = NonNullable<UpdateMenuSettingsDto['ordering']>;
type BusyKey = 'pickup' | 'delivery' | 'prepMinutes' | 'paymentMethods' | 'bankAccount';
type BankField = keyof BankAccountDto;

const DEFAULT_PREP = 20;

export const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{ key: OnlinePaymentMethod; label: string; needs: 'pickup' | 'delivery' | null }> = [
  { key: 'cash_on_pickup', label: 'Efectivo al retirar', needs: 'pickup' },
  { key: 'card_on_pickup', label: 'Tarjeta al retirar', needs: 'pickup' },
  { key: 'cash_on_delivery', label: 'Efectivo al recibir', needs: 'delivery' },
  { key: 'card_on_delivery', label: 'Tarjeta al recibir', needs: 'delivery' },
  { key: 'transfer_receipt', label: 'Transferencia con comprobante', needs: null },
];

const BANKS = [
  'Banco de Chile',
  'BancoEstado',
  'Banco Santander',
  'Banco BCI',
  'Scotiabank',
  'Banco Itaú',
  'Banco Security',
  'Banco BICE',
  'Banco Falabella',
  'Banco Ripley',
  'Banco Consorcio',
  'Banco Internacional',
  'Coopeuch',
  'Mercado Pago',
  'Tenpo',
  'MACH',
];
const ACCOUNT_TYPES = ['Cuenta corriente', 'Cuenta vista', 'Cuenta RUT', 'Cuenta de ahorro'];
const BANK_MAX: Record<BankField, number> = { bank: 60, accountType: 40, accountNumber: 30, holderName: 80, holderRut: 15, email: 120 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Retiro y delivery del local (plan online_ordering): canales, preparación, métodos de pago, datos bancarios y zonas. */
@Component({
  selector: 'app-customer-order-online-settings',
  imports: [ButtonComponent, IconComponent, ToggleComponent, DeliveryZoneListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let editable = $editable();
    @let id = $id();
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2 pt-1">
        <h4 class="text-foreground text-sm font-semibold">Retiro y delivery</h4>
        @if (!$hasFeature()) {
        <span class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
          <app-icon class="h-3.5 w-3.5" aria-hidden="true">lock</app-icon>{{ $planBadge() }}
        </span>
        }
      </div>

      @if (!$hasFeature()) {
      <div class="glass-row flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-muted-foreground text-sm">Recibe pedidos para retirar o con despacho, con zonas de reparto y pago por transferencia.</p>
        <app-button impact="light" size="small" type="button" icon="workspace_premium" (buttonClick)="upsell()">Ver planes</app-button>
      </div>
      }

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div class="glass-row flex items-center justify-between gap-3 rounded-xl p-3" [class.opacity-70]="!$hasFeature()">
          <div class="min-w-0">
            <p class="text-foreground text-sm font-medium">Retiro en el local</p>
            <p class="text-muted-foreground text-xs">Piden desde la carta y lo retiran aquí.</p>
          </div>
          <app-toggle [checked]="$pickup()" [disabled]="!editable || $busy() === 'pickup'" (changed)="setChannel('pickup', $event)" />
        </div>
        <div class="glass-row flex items-center justify-between gap-3 rounded-xl p-3" [class.opacity-70]="!$hasFeature()">
          <div class="min-w-0">
            <p class="text-foreground text-sm font-medium">Delivery</p>
            <p class="text-muted-foreground text-xs">Despacho a las zonas de reparto.</p>
          </div>
          <app-toggle [checked]="$delivery()" [disabled]="!editable || $busy() === 'delivery'" (changed)="setChannel('delivery', $event)" />
        </div>
      </div>

      @if ($hasFeature()) {
      <!-- Tiempo de preparación -->
      <div class="glass-row flex flex-col gap-2 rounded-xl p-3">
        <label [for]="id + '-prep'" class="text-foreground text-sm font-medium">Tiempo de preparación</label>
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative w-full max-w-[9rem]">
            <input
              [id]="id + '-prep'"
              type="number"
              min="5"
              max="240"
              step="1"
              inputmode="numeric"
              class="glass-input w-full rounded-md py-2 pl-3 pr-12 text-sm tabular-nums"
              [class.border-red-500]="!!$prepError()"
              [value]="$prepText()"
              [disabled]="!editable"
              (input)="$prepText.set($any($event.target).value)"
              (keydown.enter)="savePrep()" />
            <span class="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">min</span>
          </div>
          @if (editable && $prepChanged()) {
          <app-button impact="light" size="small" type="button" [disabled]="$busy() === 'prepMinutes'" (buttonClick)="$prepText.set(savedPrepText())">Descartar</app-button>
          <app-button impact="bold" tone="primary" size="small" type="button" [disabled]="!!$prepError()" [isLoading]="$busy() === 'prepMinutes'" (buttonClick)="savePrep()">
            Guardar
          </app-button>
          }
        </div>
        @if ($prepError(); as error) {
        <p class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
        } @else {
        <p class="text-muted-foreground text-xs">De 5 a 240 minutos. Es el "listo en" del retiro y la hora más temprana para programar.</p>
        }
      </div>

      <!-- Métodos de pago -->
      <fieldset class="glass-row flex flex-col gap-2 rounded-xl p-3">
        <legend class="sr-only">Métodos de pago</legend>
        <p class="text-foreground text-sm font-medium">Métodos de pago</p>
        <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          @for (option of paymentOptions; track option.key) {
          @let available = isAvailable(option.needs);
          <label class="flex items-center gap-2 rounded-lg px-1 py-1 text-sm" [class.opacity-50]="!available" [class.cursor-pointer]="editable && available">
            <input
              type="checkbox"
              class="accent-primary h-4 w-4"
              [checked]="isChecked(option.key)"
              [disabled]="!editable || !available || $busy() === 'paymentMethods'"
              (change)="toggleMethod(option.key, $any($event.target).checked)" />
            <span class="text-foreground">{{ option.label }}</span>
          </label>
          }
        </div>
        @if ($transferPending()) {
        <p class="text-xs font-medium text-red-600 dark:text-red-400" role="alert">Para aceptar transferencias, completa y guarda los datos bancarios.</p>
        }
        @if ($noMethods()) {
        <p class="text-xs font-medium text-amber-700 dark:text-amber-300">Sin un método de pago disponible, tus clientes no pueden pedir.</p>
        }
        <p class="text-muted-foreground text-xs">
          Los de retiro se activan con el retiro y los de delivery con el delivery. La aceptación automática nunca acepta transferencias: esperan que confirmes el pago.
        </p>
      </fieldset>

      <!-- Datos bancarios -->
      <div class="glass-row flex flex-col gap-3 rounded-xl p-3" [class.ring-2]="$transferPending()" [class.ring-red-500]="$transferPending()">
        <div class="flex items-center justify-between gap-2">
          <p class="text-foreground text-sm font-medium">Datos para transferencias</p>
          @if (editable && $savedBank() && !$bankEditing()) {
          <app-button impact="light" size="small" type="button" icon="edit" (buttonClick)="$bankEditing.set(true)">Editar</app-button>
          }
        </div>
        @if (!$bankEditing()) {
        @if ($savedBank(); as bank) {
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt class="text-muted-foreground">Banco</dt><dd class="text-foreground">{{ bank.bank }} · {{ bank.accountType }}</dd>
          <dt class="text-muted-foreground">Número</dt><dd class="text-foreground tabular-nums">{{ bank.accountNumber }}</dd>
          <dt class="text-muted-foreground">Titular</dt><dd class="text-foreground">{{ bank.holderName }} · {{ bank.holderRut }}</dd>
          @if (bank.email) {
          <dt class="text-muted-foreground">Correo</dt><dd class="text-foreground break-all">{{ bank.email }}</dd>
          }
        </dl>
        } @else {
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-muted-foreground text-xs">Los ve el cliente que elige pagar por transferencia.</p>
          @if (editable) {
          <app-button impact="light" size="small" type="button" icon="add" (buttonClick)="$bankEditing.set(true)">Agregar</app-button>
          }
        </div>
        }
        } @else {
        @let errors = $visibleBankErrors();
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label [for]="id + '-bank'" class="text-foreground mb-1 block text-xs font-medium">Banco *</label>
            <input [id]="id + '-bank'" type="text" autocomplete="off" class="glass-input w-full rounded-md px-3 py-2 text-sm" [attr.list]="id + '-banks'"
              [class.border-red-500]="!!errors.bank" [value]="$bank.bank()" (input)="setBank('bank', $event)" />
            <datalist [id]="id + '-banks'">
              @for (bank of banks; track bank) {
              <option [value]="bank"></option>
              }
            </datalist>
            @if (errors.bank; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
          </div>
          <div>
            <label [for]="id + '-account-type'" class="text-foreground mb-1 block text-xs font-medium">Tipo de cuenta *</label>
            <select [id]="id + '-account-type'" class="glass-input w-full rounded-md px-3 py-2 text-sm" [class.border-red-500]="!!errors.accountType" (change)="setBank('accountType', $event)">
              <option value="" [selected]="!$bank.accountType()">Elige</option>
              @for (type of $accountTypes(); track type) {
              <option [value]="type" [selected]="type === $bank.accountType()">{{ type }}</option>
              }
            </select>
            @if (errors.accountType; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
          </div>
          <div>
            <label [for]="id + '-account-number'" class="text-foreground mb-1 block text-xs font-medium">Número de cuenta *</label>
            <input [id]="id + '-account-number'" type="text" inputmode="numeric" autocomplete="off" class="glass-input w-full rounded-md px-3 py-2 text-sm tabular-nums"
              [class.border-red-500]="!!errors.accountNumber" [value]="$bank.accountNumber()" (input)="setBank('accountNumber', $event)" />
            @if (errors.accountNumber; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
          </div>
          <div>
            <label [for]="id + '-holder-name'" class="text-foreground mb-1 block text-xs font-medium">Titular *</label>
            <input [id]="id + '-holder-name'" type="text" autocomplete="off" class="glass-input w-full rounded-md px-3 py-2 text-sm" placeholder="Tu Local SpA"
              [class.border-red-500]="!!errors.holderName" [value]="$bank.holderName()" (input)="setBank('holderName', $event)" />
            @if (errors.holderName; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
          </div>
          <div>
            <label [for]="id + '-holder-rut'" class="text-foreground mb-1 block text-xs font-medium">RUT del titular *</label>
            <input [id]="id + '-holder-rut'" type="text" autocomplete="off" class="glass-input w-full rounded-md px-3 py-2 text-sm tabular-nums" placeholder="76.123.456-7"
              [class.border-red-500]="!!errors.holderRut" [value]="$bank.holderRut()" (input)="setBank('holderRut', $event)" (blur)="formatHolderRut()" />
            @if (errors.holderRut; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
          </div>
          <div>
            <label [for]="id + '-bank-email'" class="text-foreground mb-1 block text-xs font-medium">Correo para avisos</label>
            <input [id]="id + '-bank-email'" type="email" autocomplete="off" class="glass-input w-full rounded-md px-3 py-2 text-sm" placeholder="Opcional"
              [class.border-red-500]="!!errors.email" [value]="$bank.email()" (input)="setBank('email', $event)" />
            @if (errors.email; as error) {<p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>}
          </div>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <app-button impact="light" size="small" type="button" [disabled]="$busy() === 'bankAccount'" (buttonClick)="cancelBank()">Cancelar</app-button>
          <app-button impact="bold" tone="primary" size="small" type="button" [isLoading]="$busy() === 'bankAccount'" (buttonClick)="saveBank()">
            {{ $transferPending() ? 'Guardar y aceptar transferencias' : 'Guardar datos' }}
          </app-button>
        </div>
        }
      </div>

      <!-- Zonas de reparto -->
      <app-delivery-zone-list
        [locationId]="settings().locationId"
        [deliveryEnabled]="$delivery()"
        [hasCoordinates]="$hasCoordinates()"
        [editable]="editable" />
      }
    </div>
  `,
})
export class CustomerOrderOnlineSettingsComponent {
  readonly #service = inject(MenuSettingsService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #plans = inject(PublicPlansService);
  readonly #upsell = inject(PlanUpsellService);

  readonly settings = input.required<MenuSettingsDto>();
  readonly changed = output<MenuSettingsDto[]>();

  readonly paymentOptions = PAYMENT_METHOD_OPTIONS;
  readonly banks = BANKS;

  readonly #ordering = computed(() => this.settings().ordering);
  readonly $id = computed(() => `menu-${this.settings().locationId}-online`);
  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('online_ordering'));
  readonly $editable = computed(() => this.$hasFeature() && this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));
  readonly $planBadge = computed(() => {
    const name = this.#plans.planName(this.#plans.firstPlanWith(['online_ordering'])?.code);
    return name ? `Plan ${name}` : 'No incluido';
  });
  readonly $hasCoordinates = computed(() => this.settings().latitude != null && this.settings().longitude != null);

  readonly $busy = signal<BusyKey | null>(null);
  readonly $pickup = linkedSignal(() => !!this.#ordering()?.pickup);
  readonly $delivery = linkedSignal(() => !!this.#ordering()?.delivery);
  readonly $methods = linkedSignal<OnlinePaymentMethod[]>(() => [...(this.#ordering()?.paymentMethods ?? [])]);

  // Tiempo de preparación.
  readonly savedPrepText = computed(() => String(this.#ordering()?.prepMinutes ?? DEFAULT_PREP));
  readonly $prepText = linkedSignal(() => this.savedPrepText());
  readonly $prepError = computed(() => {
    const value = Number(this.$prepText().trim());
    return this.$prepText().trim() !== '' && Number.isInteger(value) && value >= 5 && value <= 240 ? null : 'Usa de 5 a 240 minutos.';
  });
  readonly $prepChanged = computed(() => this.$prepText().trim() !== this.savedPrepText());

  readonly $noMethods = computed(() => {
    if (!this.$pickup() && !this.$delivery()) return false;
    return !this.$methods().some((method) => this.isAvailable(PAYMENT_METHOD_OPTIONS.find((option) => option.key === method)?.needs ?? null));
  });

  // Datos bancarios: transferencia marcada pero sin cuenta guardada.
  readonly $transferPending = signal(false);
  readonly $savedBank = computed(() => this.#ordering()?.bankAccount ?? null);
  readonly $bankEditing = linkedSignal(() => this.$transferPending() && !this.$savedBank());
  readonly $bankShowErrors = signal(false);
  readonly $bank = {
    bank: linkedSignal(() => this.$savedBank()?.bank ?? ''),
    accountType: linkedSignal(() => this.$savedBank()?.accountType ?? ''),
    accountNumber: linkedSignal(() => this.$savedBank()?.accountNumber ?? ''),
    holderName: linkedSignal(() => this.$savedBank()?.holderName ?? ''),
    holderRut: linkedSignal(() => this.$savedBank()?.holderRut ?? ''),
    email: linkedSignal(() => this.$savedBank()?.email ?? ''),
  } as const;
  /** Incluye el tipo guardado aunque no esté en la lista. */
  readonly $accountTypes = computed(() => {
    const saved = this.$savedBank()?.accountType;
    return saved && !ACCOUNT_TYPES.includes(saved) ? [...ACCOUNT_TYPES, saved] : ACCOUNT_TYPES;
  });
  readonly $bankErrors = computed(() => {
    const errors: Partial<Record<BankField, string>> = {};
    for (const field of Object.keys(BANK_MAX) as BankField[]) {
      const value = this.$bank[field]().trim();
      if (!value && field !== 'email') errors[field] = 'Obligatorio.';
      else if (value.length > BANK_MAX[field]) errors[field] = `Máximo ${BANK_MAX[field]} caracteres.`;
    }
    const rut = this.$bank.holderRut().trim();
    if (rut && !errors.holderRut && !isValidRut(rut)) errors.holderRut = 'RUT inválido.';
    const email = this.$bank.email().trim();
    if (email && !errors.email && !EMAIL.test(email)) errors.email = 'Correo inválido.';
    return errors;
  });

  readonly $visibleBankErrors = computed<Partial<Record<BankField, string>>>(() => (this.$bankShowErrors() ? this.$bankErrors() : {}));

  isAvailable(needs: 'pickup' | 'delivery' | null): boolean {
    if (needs === 'pickup') return this.$pickup();
    if (needs === 'delivery') return this.$delivery();
    return this.$pickup() || this.$delivery();
  }

  isChecked(method: OnlinePaymentMethod): boolean {
    return this.$methods().includes(method) || (method === 'transfer_receipt' && this.$transferPending());
  }

  setChannel(key: 'pickup' | 'delivery', value: boolean) {
    const target = key === 'pickup' ? this.$pickup : this.$delivery;
    target.set(value);
    const label = key === 'pickup' ? 'Retiro en el local' : 'Delivery';
    this.#save(key, { [key]: value }, `${label} ${value ? 'activado' : 'desactivado'}`, () => target.set(!value));
  }

  savePrep() {
    if (!this.$prepChanged() || this.$prepError() || this.$busy()) return;
    this.#save('prepMinutes', { prepMinutes: Number(this.$prepText().trim()) }, 'Tiempo de preparación guardado');
  }

  toggleMethod(method: OnlinePaymentMethod, checked: boolean) {
    if (method === 'transfer_receipt' && !this.$savedBank()) {
      this.$transferPending.set(checked);
      if (!checked) this.$bankShowErrors.set(false);
      return;
    }
    const previous = this.$methods();
    const next = checked ? [...previous, method] : previous.filter((item) => item !== method);
    this.$methods.set(next);
    this.#save('paymentMethods', { paymentMethods: next }, 'Métodos de pago guardados', () => this.$methods.set(previous));
  }

  setBank(field: BankField, event: Event) {
    this.$bank[field].set((event.target as HTMLInputElement | HTMLSelectElement).value);
  }

  formatHolderRut() {
    const value = this.$bank.holderRut().trim();
    if (value) this.$bank.holderRut.set(formatRut(value));
  }

  cancelBank() {
    for (const field of Object.keys(this.$bank) as BankField[]) {
      const saved = this.$savedBank();
      this.$bank[field].set(saved?.[field] ?? '');
    }
    this.$bankShowErrors.set(false);
    this.$bankEditing.set(false);
    this.$transferPending.set(false);
  }

  saveBank() {
    this.formatHolderRut();
    this.$bankShowErrors.set(true);
    if (Object.keys(this.$bankErrors()).length || this.$busy()) return;
    const text = (field: BankField) => this.$bank[field]().trim();
    const bankAccount: BankAccountDto = {
      bank: text('bank'),
      accountType: text('accountType'),
      accountNumber: text('accountNumber'),
      holderName: text('holderName'),
      holderRut: text('holderRut'),
      email: text('email') || null,
    };
    const withTransfer = this.$transferPending();
    const changes: OrderingChanges = withTransfer ? { bankAccount, paymentMethods: [...this.$methods(), 'transfer_receipt'] } : { bankAccount };
    this.#save('bankAccount', changes, withTransfer ? 'Transferencias activadas' : 'Datos bancarios guardados', undefined, () => {
      this.$transferPending.set(false);
      this.$bankShowErrors.set(false);
      this.$bankEditing.set(false);
    });
  }

  upsell() {
    this.#upsell.open({ features: ['online_ordering'] });
  }

  #save(key: BusyKey, ordering: OrderingChanges, message: string, rollback?: () => void, done?: () => void) {
    if (this.$busy()) {
      rollback?.();
      return;
    }
    this.$busy.set(key);
    this.#service.update(this.settings().locationId, { ordering }).subscribe({
      next: (settings) => {
        this.$busy.set(null);
        done?.();
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
