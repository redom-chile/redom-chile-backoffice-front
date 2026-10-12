import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, switchMap } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { RouterLink } from '@angular/router';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { SubscriptionStatus } from 'src/app/core/services/entitlements';
import { BillingJobSummaryDto, formatClp, formatPlatformDate, getPlatformErrorMessage, PlatformService } from '../../data-access';
import { PaymentReviewCountService } from '../../features/payment-review-count';

type CountCard = Readonly<{ label: string; value: number; hint: string; status?: SubscriptionStatus; tone?: string }>;

const TRIALS_PER_PAGE = 50;

/** Resumen de la plataforma: negocios por estado, MRR, ARR, ingresos, vencido y bajas. */
@Component({
  selector: 'app-platform-summary',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, CheckPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-summary.component.html',
})
export class PlatformSummaryComponent {
  readonly #platform = inject(PlatformService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  protected readonly PERMISSIONS = PERMISSIONS;

  // Proceso diario de cobros (soporte o pruebas).
  readonly $jobRunning = signal(false);
  readonly $jobResult = signal<BillingJobSummaryDto | null>(null);
  readonly $jobRows = computed(() => {
    const job = this.$jobResult();
    if (!job) return [];
    return [
      { label: 'Pruebas terminadas', value: job.trialsEnded },
      { label: 'Renovaciones', value: job.renewals },
      { label: 'Cobros con tarjeta aprobados', value: job.cardCharges.paid },
      { label: 'Cobros con tarjeta rechazados', value: job.cardCharges.rejected },
      { label: 'Cobros con tarjeta en proceso', value: job.cardCharges.pending },
      { label: 'Pasaron a pago atrasado', value: job.pastDue },
      { label: 'Vencidas (a Free)', value: job.expired },
      { label: 'Canceladas (a Free)', value: job.cancelled },
      { label: 'Cobros vencidos', value: job.invoicesOverdue },
      { label: 'Compras anuladas sin pago', value: job.purchasesVoided },
      { label: 'Excepciones vencidas', value: job.overridesExpired },
      { label: 'Correos enviados', value: job.emails },
    ];
  });
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

  handleRunJob() {
    if (this.$jobRunning()) return;
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Ejecutar proceso diario',
          message:
            'Procesa ahora pruebas, renovaciones, cobros con tarjeta, pagos atrasados y correos, como lo hace el sistema cada día. Correrlo dos veces el mismo día no duplica cobros ni correos.',
          confirmText: 'Ejecutar',
        },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.$jobRunning.set(true);
          return this.#platform.runDailyJob();
        }),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: (job) => {
          this.$jobRunning.set(false);
          this.$jobResult.set(job);
          if (!job.ran) this.#toast.show('Ya había un proceso en curso. Inténtalo en unos minutos.', 'warning');
          else if (job.errors > 0) this.#toast.show(`Proceso terminado con ${job.errors} errores (revisa los logs).`, 'warning');
          else this.#toast.show('Proceso diario terminado', 'success');
          this.reload();
        },
        error: (error: unknown) => {
          this.$jobRunning.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo ejecutar el proceso diario.'), 'error');
        },
      });
  }

  formatJobDate(value: string): string {
    return formatPlatformDate(value, true);
  }

  reload() {
    this.summary.reload();
    this.trials.reload();
  }
}
