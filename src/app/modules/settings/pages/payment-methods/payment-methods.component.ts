import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import {
  getFinanceErrorMessage,
  PaymentFeesService,
  PaymentMethodSettingDto,
} from 'src/app/modules/finance/data-access';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { PaymentMethodCardComponent } from './features';

/** Configuración → Medios de pago: comisión y días hasta el abono de cada medio (el efectivo no tiene). */
@Component({
  selector: 'app-payment-methods',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    PaymentMethodCardComponent,
  ],
  templateUrl: './payment-methods.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodsComponent {
  readonly #fees = inject(PaymentFeesService);
  readonly #settings = inject(BusinessSettingsService);

  readonly $vatRate = this.#settings.$vatRate;
  readonly $decimals = this.#settings.$currencyPrecision;

  readonly settings = rxResource({ stream: () => this.#fees.settings().pipe(toRemoteResult()) });

  // Lista local: al guardar una tarjeta se reemplaza su medio sin recargar todo.
  readonly $list = linkedSignal<PaymentMethodSettingDto[] | null>(() => resultValue(this.settings.value()));
  readonly $cards = computed(() => (this.$list() ?? []).filter((setting) => setting.method !== 'cash'));
  readonly $hasCash = computed(() => (this.$list() ?? []).some((setting) => setting.method === 'cash'));
  readonly $error = computed(() => resultError(this.settings.value()));
  readonly $errorMessage = computed(() =>
    getFinanceErrorMessage(this.$error(), 'No se pudieron cargar los medios de pago.'),
  );
  readonly $isFirstLoad = computed(() => this.settings.isLoading() && !this.$list());

  onSaved(setting: PaymentMethodSettingDto) {
    this.$list.update((list) => (list ? list.map((item) => (item.method === setting.method ? setting : item)) : list));
  }
}
