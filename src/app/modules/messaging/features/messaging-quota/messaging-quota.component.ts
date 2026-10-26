import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { formatNumber } from 'src/app/modules/messaging/data-access';
import { IconComponent } from 'src/ui';

/** Cupo de correos del mes (customerEmailsMonth). Las pruebas también cuentan. */
@Component({
  selector: 'app-messaging-quota',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let limit = $limit();
    <section class="glass flex flex-col gap-2 rounded-[1rem] p-4" aria-label="Cupo de correos del mes">
      <div class="flex flex-wrap items-center gap-2">
        <app-icon class="text-primary h-5 w-5" aria-hidden="true">mail</app-icon>
        <p class="text-foreground text-sm font-semibold">
          @if (limit === null) {
          {{ format($used()) }} correos este mes
          } @else {
          {{ format($used()) }} de {{ format(limit) }} correos este mes
          }
        </p>
        @if ($isNearLimit()) {
        <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          {{ $remaining() === 0 ? 'Sin cupo' : 'Queda poco' }}
        </span>
        }
      </div>
      @if (limit !== null) {
      <div
        class="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Correos usados este mes"
        [attr.aria-valuenow]="$used()"
        aria-valuemin="0"
        [attr.aria-valuemax]="limit">
        <div class="h-full rounded-full transition-all" [class]="$isNearLimit() ? 'bg-amber-500' : 'bg-primary'" [style.width.%]="$percent()"></div>
      </div>
      }
      <p class="text-muted-foreground text-xs">
        Cuentan los automáticos, las campañas y las pruebas. El cupo se renueva cada mes.
      </p>
    </section>
  `,
})
export class MessagingQuotaComponent {
  readonly #entitlements = inject(EntitlementsService);

  readonly $used = computed(() => this.#entitlements.usageOf('customerEmailsMonth'));
  readonly $limit = computed(() => this.#entitlements.limitOf('customerEmailsMonth'));
  readonly $remaining = computed(() => {
    const limit = this.$limit();
    return limit === null ? null : Math.max(limit - this.$used(), 0);
  });
  readonly $percent = computed(() => {
    const limit = this.$limit();
    return !limit ? 0 : Math.min(100, Math.round((this.$used() / limit) * 100));
  });
  readonly $isNearLimit = computed(() => this.$limit() !== null && this.$percent() >= 90);

  constructor() {
    this.#entitlements.refresh();
  }

  format(value: number): string {
    return formatNumber(value);
  }
}
