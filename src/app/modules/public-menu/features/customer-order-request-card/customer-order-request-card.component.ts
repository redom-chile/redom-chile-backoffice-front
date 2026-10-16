import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from 'src/app/core/permissions';
import { StaffTableRequestDto, TableRequestType } from 'src/app/modules/public-menu/data-access';
import { formatElapsed, formatOrderDate } from 'src/app/modules/public-menu/features/customer-order-card';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, IconComponent } from 'src/ui';

// Minutos de espera desde los que la solicitud se destaca.
const LATE_MINUTES = 3;

export const TABLE_REQUEST_TYPES: Record<TableRequestType, { label: string; icon: string; classes: string }> = {
  call_waiter: { label: 'Llama al mesero', icon: 'room_service', classes: 'bg-primary/10 text-primary' },
  request_bill: { label: 'Pide la cuenta', icon: 'receipt_long', classes: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  other: { label: 'Otra solicitud', icon: 'chat', classes: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
};

/** Una solicitud de una mesa (llamar al mesero, pedir la cuenta u otra), con el botón Atendida si está abierta. */
@Component({
  selector: 'app-customer-order-request-card',
  imports: [RouterLink, ButtonComponent, IconComponent, CheckPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = request();
    @let type = $type();
    <article class="glass flex flex-col gap-3 rounded-[1rem] p-4" [class.ring-2]="$isLate()" [class.ring-amber-500]="$isLate()">
      <header class="flex items-start gap-3">
        <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full" [class]="type.classes">
          <app-icon class="h-6 w-6" aria-hidden="true">{{ type.icon }}</app-icon>
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-foreground truncate text-lg font-semibold">{{ r.table.name }}</h3>
          <p class="text-muted-foreground text-xs">
            <span class="text-foreground font-medium">{{ type.label }}</span> ·
            @if (r.status === 'open') {
            <span [class]="$isLate() ? 'font-semibold text-amber-700 dark:text-amber-400' : ''">{{ $elapsed() }}</span>
            } @else {
            atendida {{ $attendedAt() }}
            }
          </p>
        </div>
        @if (r.status === 'attended') {
        <span class="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">Atendida</span>
        }
      </header>

      @if (r.note) {
      <p class="glass-row text-foreground rounded-lg px-3 py-2 text-sm"><span class="text-muted-foreground text-xs">Nota:</span> {{ r.note }}</p>
      }

      @if (r.status === 'attended' && r.attendedBy) {
      <p class="text-muted-foreground text-xs">Por {{ r.attendedBy }}</p>
      }

      @if (r.status === 'open') {
      <div class="flex flex-wrap items-center justify-between gap-2">
        @if (r.type === 'request_bill') {
        <a
          *appCheckPermission="PERMISSIONS.ORDERS.SEE_MODULE"
          routerLink="/orders"
          [queryParams]="{ location: r.locationId, table: r.table.id, status: 'ORDERED' }"
          class="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline">
          Ver venta de la mesa<app-icon class="h-4 w-4" aria-hidden="true">chevron_right</app-icon>
        </a>
        }
        @if (canManage()) {
        <app-button class="ml-auto" impact="bold" tone="primary" size="small" type="button" icon="check" [disabled]="busy()" [isLoading]="busy()" (buttonClick)="attend.emit(r)">
          Atendida
        </app-button>
        }
      </div>
      }
    </article>
  `,
})
export class CustomerOrderRequestCardComponent {
  readonly request = input.required<StaffTableRequestDto>();
  /** Hora actual (ms) para la espera en vivo. */
  readonly now = input(Date.now());
  readonly canManage = input(false);
  readonly busy = input(false);

  readonly attend = output<StaffTableRequestDto>();

  readonly PERMISSIONS = PERMISSIONS;
  readonly $type = computed(() => TABLE_REQUEST_TYPES[this.request().type] ?? TABLE_REQUEST_TYPES.other);
  readonly $elapsed = computed(() => formatElapsed(this.request().createdAt, this.now()));
  readonly $attendedAt = computed(() => formatOrderDate(this.request().attendedAt));
  readonly $isLate = computed(
    () => this.request().status === 'open' && this.now() - new Date(this.request().createdAt).getTime() >= LATE_MINUTES * 60000,
  );
}
