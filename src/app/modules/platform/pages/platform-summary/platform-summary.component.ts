import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { SubscriptionStatus } from 'src/app/core/services/entitlements';
import { formatClp, formatPlatformDate, getPlatformErrorMessage, PlatformService } from '../../data-access';
import { PaymentReviewCountService } from '../../features/payment-review-count';

type CountCard = Readonly<{ label: string; value: number; hint: string; status?: SubscriptionStatus; tone?: string }>;

const TRIALS_PER_PAGE = 50;

/** Resumen de la plataforma: negocios por estado, MRR, ARR, ingresos, vencido y bajas. */
@Component({
  selector: 'app-platform-summary',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-summary.component.html',
})
export class PlatformSummaryComponent {
  readonly #platform = inject(PlatformService);
  /** Transferencias por revisar (mismo contador que el menú). */
  readonly $reviewCount = inject(PaymentReviewCountService).$count;

  readonly formatClp = formatClp;
  readonly formatDate = formatPlatformDate;
  readonly skeletonCards = [1, 2, 3, 4, 5, 6];
  readonly skeletonRows = [1, 2, 3];

  readonly summary = rxResource({ stream: () => this.#platform.getSummary().pipe(toRemoteResult()) });
  readonly $summary = computed(() => resultValue(this.summary.value()));
  readonly $error = computed(() => resultError(this.summary.value()));
  readonly $errorMessage = computed(() => getPlatformErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly $counts = computed<CountCard[]>(() => {
    const businesses = this.$summary()?.businesses;
    if (!businesses) return [];
    return [
      { label: 'Negocios', value: businesses.total, hint: 'Todos los registrados' },
      { label: 'En prueba', value: businesses.trialing, hint: 'Probando un plan pagado', status: 'trialing' },
      { label: 'Activos', value: businesses.active, hint: 'Pagando un plan pagado', status: 'active' },
      { label: 'Pago atrasado', value: businesses.pastDue, hint: 'En período de gracia', status: 'past_due', tone: businesses.pastDue > 0 ? 'text-red-600 dark:text-red-400' : '' },
      { label: 'Vencidos', value: businesses.expired, hint: 'Vencidos, cancelados o con la prueba o gracia terminadas' },
      { label: 'Free', value: businesses.free, hint: 'En plan gratis o sin suscripción' },
    ];
  });

  // Pruebas que terminan en 7 días o menos (incluye las que ya debieron terminar y siguen en prueba).
  readonly trials = rxResource({
    stream: () => this.#platform.getBusinesses({ trialEndingInDays: 7, perPage: TRIALS_PER_PAGE }).pipe(toRemoteResult()),
  });
  readonly $trials = computed(() =>
    [...(resultValue(this.trials.value())?.data ?? [])].sort((a, b) => (a.trialEndsAt ?? '').localeCompare(b.trialEndsAt ?? '')),
  );
  readonly $trialsTotal = computed(() => resultValue(this.trials.value())?.pagination.totalItems ?? 0);
  readonly $trialsError = computed(() => resultError(this.trials.value()));
  readonly $trialsErrorMessage = computed(() => getPlatformErrorMessage(this.$trialsError(), 'Intenta nuevamente.'));

  /** "Hoy", "Mañana", "En 3 días" o "Terminó" (según la hora actual). */
  trialCountdown(iso: string | null): string {
    if (!iso) return '';
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'Terminó';
    const days = Math.floor(ms / 86_400_000);
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Mañana';
    return `En ${days} días`;
  }

  reload() {
    this.summary.reload();
    this.trials.reload();
  }
}
