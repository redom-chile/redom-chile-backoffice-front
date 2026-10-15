import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { PublicApiService, WebhookDeliveryDto, WebhookEndpointDto } from 'src/app/modules/public-menu/data-access';
import {
  DELIVERY_STATUS_CLASSES,
  DELIVERY_STATUS_LABELS,
  eventLabel,
  formatDateTime,
  formatRelative,
  publicApiError,
} from 'src/app/modules/public-menu/features/public-api-shared';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, EmptyStateComponent, IconComponent, ModalCardComponent, SkeletonComponent, SlotDirective, ToastService } from 'src/ui';
import { deliveryResultMessage } from './webhook-format';

export type WebhookDeliveriesModalData = Readonly<{ endpoint: WebhookEndpointDto }>;

const LIMIT = 50;

/** Historial de envíos de un webhook (los más nuevos primero), con el payload y Reenviar. */
@Component({
  selector: 'app-webhook-deliveries-modal',
  imports: [JsonPipe, ModalCardComponent, SlotDirective, ButtonComponent, IconComponent, SkeletonComponent, EmptyStateComponent, CheckPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h2 class="text-xl font-semibold">Historial de envíos</h2>
            <p class="text-muted-foreground truncate font-mono text-xs font-normal">{{ data.endpoint.url }}</p>
          </div>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            aria-label="Actualizar"
            title="Actualizar"
            [disabled]="deliveries.isLoading()"
            (click)="deliveries.reload()">
            <app-icon class="h-5 w-5" [class.animate-spin]="deliveries.isLoading()">refresh</app-icon>
          </button>
        </div>
      </ng-template>

      <div class="p-2">
        @if ($error()) {
        <div class="flex flex-col items-center gap-3 py-10 text-center">
          <app-icon class="text-destructive h-10 w-10">error_outline</app-icon>
          <p class="text-muted-foreground text-sm">{{ $errorMessage() }}</p>
          <app-button impact="light" size="small" type="button" (buttonClick)="deliveries.reload()">Reintentar</app-button>
        </div>
        } @else if (deliveries.isLoading() && !$list()) {
        <div class="space-y-2">
          @for (row of [1, 2, 3, 4]; track row) {
          <app-skeleton size="sm" style="width: 100%" />
          }
        </div>
        } @else if (!$list()?.length) {
        <app-empty-state icon="history" title="Aún no hay envíos" description="Cuando ocurra un evento (o uses Probar) aparecerá aquí." />
        } @else {
        <p class="text-muted-foreground mb-2 text-xs">Últimos {{ limit }} envíos. Toca una fila para ver el JSON enviado.</p>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="text-muted-foreground border-b border-[var(--border)] text-xs">
              <tr>
                <th class="py-2 pr-2 font-medium">Evento</th>
                <th class="px-2 py-2 font-medium">Estado</th>
                <th class="px-2 py-2 text-right font-medium">Intentos</th>
                <th class="px-2 py-2 font-medium">Último código</th>
                <th class="px-2 py-2 font-medium">Próximo intento</th>
                <th class="px-2 py-2 font-medium">Fecha</th>
                <th class="py-2 pl-2"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (delivery of $list(); track delivery.id) {
              @let open = $expanded() === delivery.id;
              <tr class="hover:bg-muted/30 cursor-pointer border-b border-[var(--border)]" [attr.aria-expanded]="open" (click)="toggle(delivery.id)">
                <td class="py-2 pr-2">
                  <span class="inline-flex items-center gap-1">
                    <app-icon class="text-muted-foreground h-4 w-4 shrink-0 transition-transform" [class.rotate-90]="open" aria-hidden="true">chevron_right</app-icon>
                    <span>
                      <span class="block">{{ eventLabel(delivery.event) }}</span>
                      <span class="text-muted-foreground block font-mono text-xs">{{ delivery.event }}</span>
                    </span>
                  </span>
                </td>
                <td class="px-2 py-2">
                  <span class="rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap" [class]="statusClasses[delivery.status]">{{ statusLabels[delivery.status] }}</span>
                </td>
                <td class="px-2 py-2 text-right tabular-nums">{{ delivery.attempts }}</td>
                <td class="px-2 py-2">
                  @if (delivery.lastStatusCode) {
                  <span class="font-mono">{{ delivery.lastStatusCode }}</span>
                  } @else if (delivery.lastError) {
                  <span class="text-muted-foreground line-clamp-1 text-xs" [attr.title]="delivery.lastError">{{ delivery.lastError }}</span>
                  } @else { — }
                </td>
                <td class="px-2 py-2 text-xs whitespace-nowrap" [attr.title]="formatDateTime(delivery.nextAttemptAt)">
                  {{ delivery.status === 'pending' && delivery.nextAttemptAt ? formatRelative(delivery.nextAttemptAt) : '—' }}
                </td>
                <td class="px-2 py-2 text-xs whitespace-nowrap">{{ formatDateTime(delivery.createdAt) }}</td>
                <td class="py-2 pl-2 text-right" (click)="$event.stopPropagation()">
                  @if (delivery.status !== 'delivered') {
                  <app-button
                    *appCheckPermission="PERMISSIONS.PUBLIC_API.MANAGE"
                    type="button"
                    impact="light"
                    tone="primary"
                    size="small"
                    [isLoading]="$retryingId() === delivery.id"
                    [disabled]="$retryingId() !== null"
                    (buttonClick)="retry(delivery)">
                    Reenviar
                  </app-button>
                  }
                </td>
              </tr>
              @if (open) {
              <tr class="border-b border-[var(--border)]">
                <td colspan="7" class="py-2">
                  @if (delivery.lastError) {
                  <p class="text-destructive mb-2 text-xs">Error: {{ delivery.lastError }}</p>
                  }
                  @if (delivery.deliveredAt) {
                  <p class="text-muted-foreground mb-2 text-xs">Entregado el {{ formatDateTime(delivery.deliveredAt) }}</p>
                  }
                  <pre class="max-h-72 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-100">{{ delivery.payload | json }}</pre>
                </td>
              </tr>
              }
              }
            </tbody>
          </table>
        </div>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end">
          <app-button type="button" impact="light" tone="primary" (buttonClick)="dialogRef.close()">Cerrar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class WebhookDeliveriesModalComponent {
  readonly dialogRef = inject<MatDialogRef<WebhookDeliveriesModalComponent>>(MatDialogRef);
  readonly data = inject<WebhookDeliveriesModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(PublicApiService);
  readonly #toast = inject(ToastService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly limit = LIMIT;
  readonly statusLabels = DELIVERY_STATUS_LABELS;
  readonly statusClasses = DELIVERY_STATUS_CLASSES;
  readonly eventLabel = eventLabel;
  readonly formatDateTime = formatDateTime;
  readonly formatRelative = formatRelative;

  readonly deliveries = rxResource({ stream: () => this.#service.getDeliveries(this.data.endpoint.id, LIMIT).pipe(toRemoteResult()) });
  readonly $list = computed(() => resultValue(this.deliveries.value()));
  readonly $error = computed(() => resultError(this.deliveries.value()));
  readonly $errorMessage = computed(() => publicApiError(this.$error(), 'No se pudo cargar el historial.') ?? 'No se pudo cargar el historial.');
  readonly $expanded = signal<number | null>(null);
  readonly $retryingId = signal<number | null>(null);

  toggle(id: number) {
    this.$expanded.update((current) => (current === id ? null : id));
  }

  retry(delivery: WebhookDeliveryDto) {
    if (this.$retryingId() !== null) return;
    this.$retryingId.set(delivery.id);
    this.#service.retryDelivery(this.data.endpoint.id, delivery.id).subscribe({
      next: (result) => {
        this.$retryingId.set(null);
        const { message, type } = deliveryResultMessage(result);
        this.#toast.show(message, type);
        this.deliveries.reload();
      },
      error: (error: unknown) => {
        this.$retryingId.set(null);
        const message = publicApiError(error, 'No se pudo reenviar.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }
}

export function openWebhookDeliveriesModal(dialog: MatDialog, data: WebhookDeliveriesModalData): Observable<void> {
  return dialog
    .open<WebhookDeliveriesModalComponent, WebhookDeliveriesModalData, void>(WebhookDeliveriesModalComponent, {
      width: '960px',
      maxWidth: '95vw',
      autoFocus: false,
      data,
    })
    .afterClosed();
}
