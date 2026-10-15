import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  formatLoyaltyBalance,
  formatLoyaltyDate,
  formatSigned,
  getLoyaltyErrorMessage,
  LoyaltyCustomerDto,
  LoyaltyMechanic,
  LoyaltyService,
  MOVEMENT_KIND_LABELS,
  rewardValueLabel,
} from 'src/app/modules/loyalty/data-access';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, EmptyStateComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { openAdjustBalanceModal } from './adjust-balance-modal.component';

/** Pestaña Clientes: saldo, recompensas al alcance y últimos movimientos, por teléfono. */
@Component({
  selector: 'app-loyalty-customers',
  imports: [RouterLink, ButtonComponent, EmptyStateComponent, IconComponent, SkeletonComponent, CheckPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loyalty-customers.component.html',
})
export class LoyaltyCustomersComponent {
  readonly #service = inject(LoyaltyService);
  readonly #dialog = inject(MatDialog);

  readonly mechanic = input<LoyaltyMechanic | null>(null);

  readonly PERMISSIONS = PERMISSIONS;
  readonly kindLabels = MOVEMENT_KIND_LABELS;
  readonly formatDate = formatLoyaltyDate;
  readonly formatSigned = formatSigned;
  readonly valueLabel = rewardValueLabel;

  readonly $input = signal('');
  // El backend busca por los últimos 8 dígitos: sirve con o sin +56 y con espacios.
  readonly $phone = signal<string | null>(null);
  readonly $inputError = signal<string | null>(null);

  readonly customer = rxResource({
    params: () => this.$phone() ?? undefined,
    stream: ({ params }) => this.#service.getCustomer({ phone: params }).pipe(toRemoteResult()),
  });
  readonly $customer = linkedSignal<LoyaltyCustomerDto | null>(() => resultValue(this.customer.value()));
  readonly $error = computed(() => resultError(this.customer.value()));
  readonly $notFound = computed(() => readApiError(this.$error()).status === 404);
  readonly $errorMessage = computed(() => getLoyaltyErrorMessage(this.$error(), 'No se pudo buscar al cliente.') ?? 'No se pudo buscar al cliente.');
  readonly $unitMechanic = computed(() => this.$customer()?.mechanic ?? this.mechanic());

  balance(amount: number): string {
    return formatLoyaltyBalance(amount, this.$unitMechanic());
  }

  search() {
    const value = this.$input().trim();
    if (value.replace(/\D/g, '').length < 8) {
      this.$inputError.set('Ingresa el celular completo (al menos 8 dígitos).');
      return;
    }
    this.$inputError.set(null);
    if (value === this.$phone()) this.customer.reload();
    else this.$phone.set(value);
  }

  clear() {
    this.$input.set('');
    this.$phone.set(null);
    this.$inputError.set(null);
  }

  adjust(customer: LoyaltyCustomerDto) {
    openAdjustBalanceModal(this.#dialog, { customer })
      .pipe(filter((updated) => !!updated))
      .subscribe((updated) => this.$customer.set(updated!));
  }
}
