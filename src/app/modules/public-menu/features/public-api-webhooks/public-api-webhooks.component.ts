import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { PublicApiService, WebhookEndpointDto } from 'src/app/modules/public-menu/data-access';
import { eventLabel, formatRelative, openSecretOnceModal, publicApiError } from 'src/app/modules/public-menu/features/public-api-shared';
import { isFeatureNotIncluded, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  EmptyStateComponent,
  IconComponent,
  SkeletonComponent,
  ToastService,
  ToggleComponent,
} from 'src/ui';
import { PublicApiDeveloperHelpComponent } from './public-api-developer-help.component';
import { openWebhookDeliveriesModal } from './webhook-deliveries-modal.component';
import { openWebhookFormModal } from './webhook-form-modal.component';
import { deliveryResultMessage } from './webhook-format';

const MAX_ENDPOINTS = 5;
type Busy = 'toggle' | 'delete' | 'rotate' | 'test';

/** Pestaña Webhooks: endpoints que reciben los eventos de los pedidos. */
@Component({
  selector: 'app-public-api-webhooks',
  imports: [MarketingUpsellCardComponent, ButtonComponent, IconComponent, SkeletonComponent, EmptyStateComponent, ToggleComponent, CheckPermissionDirective, PublicApiDeveloperHelpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-api-webhooks.component.html',
})
export class PublicApiWebhooksComponent {
  readonly #service = inject(PublicApiService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly maxEndpoints = MAX_ENDPOINTS;
  readonly eventLabel = eventLabel;
  readonly formatRelative = formatRelative;
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_API.MANAGE));

  readonly webhooks = rxResource({ stream: () => this.#service.getWebhooks().pipe(toRemoteResult()) });
  readonly $list = linkedSignal(() => resultValue(this.webhooks.value()));
  readonly $error = computed(() => resultError(this.webhooks.value()));
  /** El plan cambió desde que se cargaron los entitlements. */
  readonly $blocked = computed(() => isFeatureNotIncluded(this.$error()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.$error()));
  readonly $errorMessage = computed(() => publicApiError(this.$error(), 'No se pudieron cargar los webhooks.') ?? 'No se pudieron cargar los webhooks.');
  readonly $isFull = computed(() => (this.$list()?.length ?? 0) >= MAX_ENDPOINTS);
  readonly $busy = signal<{ id: number; action: Busy } | null>(null);

  isBusy(endpoint: WebhookEndpointDto, action?: Busy): boolean {
    const busy = this.$busy();
    return !!busy && busy.id === endpoint.id && (!action || busy.action === action);
  }

  create() {
    if (this.$isFull()) {
      this.#toast.show(`Puedes tener hasta ${MAX_ENDPOINTS} webhooks: elimina uno primero.`, 'warning');
      return;
    }
    openWebhookFormModal(this.#dialog)
      .pipe(filter((saved) => !!saved))
      .subscribe((saved) => {
        this.webhooks.reload();
        if (saved && 'secret' in saved) this.#showSecret(saved.url, saved.secret, 'Este es el secreto para verificar la firma de los envíos.');
      });
  }

  edit(endpoint: WebhookEndpointDto) {
    openWebhookFormModal(this.#dialog, { endpoint })
      .pipe(filter((saved) => !!saved))
      .subscribe((saved) => this.#replace(saved!));
  }

  toggle(endpoint: WebhookEndpointDto, isActive: boolean) {
    if (this.$busy()) return;
    this.$busy.set({ id: endpoint.id, action: 'toggle' });
    this.#replace({ ...endpoint, isActive });
    this.#service.updateWebhook(endpoint.id, { isActive }).subscribe({
      next: (saved) => {
        this.$busy.set(null);
        this.#replace(saved);
        this.#toast.show(isActive ? 'Webhook activado' : 'Webhook desactivado', 'success');
      },
      error: (error: unknown) => {
        this.$busy.set(null);
        this.#replace(endpoint);
        const message = publicApiError(error, 'No se pudo cambiar el webhook.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  remove(endpoint: WebhookEndpointDto) {
    this.#confirm({
      title: 'Eliminar webhook',
      message: `¿Eliminar el webhook a ${endpoint.url}? Deja de recibir eventos y se borra su historial.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    })
      .pipe(
        switchMap(() => {
          this.$busy.set({ id: endpoint.id, action: 'delete' });
          return this.#service.deleteWebhook(endpoint.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busy.set(null);
          this.$list.update((list) => list?.filter((item) => item.id !== endpoint.id) ?? null);
          this.#toast.show('Webhook eliminado', 'success');
        },
        error: (error: unknown) => {
          this.$busy.set(null);
          const message = publicApiError(error, 'No se pudo eliminar el webhook.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  rotate(endpoint: WebhookEndpointDto) {
    this.#confirm({
      title: 'Rotar secreto',
      message: 'Se crea un secreto nuevo y el actual deja de firmar al instante. Tendrás que actualizarlo en tu servidor.',
      confirmText: 'Rotar secreto',
      tone: 'danger',
    })
      .pipe(
        switchMap(() => {
          this.$busy.set({ id: endpoint.id, action: 'rotate' });
          return this.#service.rotateWebhookSecret(endpoint.id);
        }),
      )
      .subscribe({
        next: ({ secret, ...saved }) => {
          this.$busy.set(null);
          this.#replace(saved);
          this.#showSecret(saved.url, secret, 'Este es el nuevo secreto. Reemplaza el anterior en tu servidor: el anterior ya no sirve.');
        },
        error: (error: unknown) => {
          this.$busy.set(null);
          const message = publicApiError(error, 'No se pudo rotar el secreto.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  test(endpoint: WebhookEndpointDto) {
    if (this.$busy()) return;
    this.$busy.set({ id: endpoint.id, action: 'test' });
    this.#service.testWebhook(endpoint.id).subscribe({
      next: (result) => {
        this.$busy.set(null);
        const { message, type } = deliveryResultMessage(result);
        this.#toast.show(`Prueba: ${message}`, type);
      },
      error: (error: unknown) => {
        this.$busy.set(null);
        const message = publicApiError(error, 'No se pudo enviar la prueba.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  history(endpoint: WebhookEndpointDto) {
    openWebhookDeliveriesModal(this.#dialog, { endpoint });
  }

  #showSecret(url: string, secret: string, description: string) {
    openSecretOnceModal(this.#dialog, { title: 'Secreto del webhook', secret, description: `${description} (${url})`, masculine: true });
  }

  #confirm(data: Omit<ConfirmModalData, 'cancelText'>) {
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: { ...data, cancelText: 'Volver' },
      })
      .afterClosed()
      .pipe(filter((confirmed) => !!confirmed));
  }

  #replace(endpoint: WebhookEndpointDto) {
    this.$list.update((list) => list?.map((item) => (item.id === endpoint.id ? endpoint : item)) ?? null);
  }
}
