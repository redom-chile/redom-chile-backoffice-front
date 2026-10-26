import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  CAMPAIGN_STATUS_CLASSES,
  CAMPAIGN_STATUS_LABELS,
  CampaignDto,
  campaignStatsSummary,
  formatDateTime,
  isFeatureNotIncluded,
  messagingError,
  MessagingService,
} from 'src/app/modules/messaging/data-access';
import { HelpLinksComponent, MESSAGING_HELP } from 'src/app/modules/messaging/features/template-tools';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, IconComponent, ToastService } from 'src/ui';

const REFRESH_MS = 30_000;

/** Pestaña "Campañas": lista (recientes primero); se refresca cada 30 s mientras alguna se está enviando. */
@Component({
  selector: 'app-campaign-list',
  imports: [RouterLink, ButtonComponent, IconComponent, HelpLinksComponent, CheckPermissionDirective, MarketingUpsellCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaign-list.component.html',
})
export class CampaignListComponent {
  readonly #service = inject(MessagingService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #business = inject(BusinessSettingsService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly statusLabels = CAMPAIGN_STATUS_LABELS;
  readonly statusClasses = CAMPAIGN_STATUS_CLASSES;
  readonly helpLinks = [MESSAGING_HELP.campaigns, MESSAGING_HELP.unsubscribes];
  readonly $canSend = computed(() => this.#access.can(PERMISSIONS.MESSAGING.SEND_CAMPAIGNS));

  readonly campaigns = rxResource({ stream: () => this.#service.getCampaigns().pipe(toRemoteResult()) });
  readonly $items = linkedSignal<CampaignDto[]>(() => resultValue(this.campaigns.value()) ?? []);
  readonly $planBlocked = computed(() => isFeatureNotIncluded(resultError(this.campaigns.value())));
  readonly $error = computed(() => {
    const error = resultError(this.campaigns.value());
    return error && !this.$planBlocked() ? messagingError(error, 'No se pudieron cargar las campañas.').message : null;
  });
  readonly $hasSending = computed(() => this.$items().some((item) => item.status === 'sending'));
  readonly $busy = signal<number | null>(null);

  constructor() {
    effect((onCleanup) => {
      if (!this.$hasSending()) return;
      const timer = setInterval(() => {
        if (document.visibilityState === 'visible' && !this.campaigns.isLoading()) this.campaigns.reload();
      }, REFRESH_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  dateLine(campaign: CampaignDto): string {
    const zone = this.#business.$settings()?.timeZone;
    switch (campaign.status) {
      case 'scheduled':
        return `Programada para el ${formatDateTime(campaign.scheduledAt, zone)}`;
      case 'sending':
        return campaign.sentAt ? `Enviando desde el ${formatDateTime(campaign.sentAt, zone)}` : 'Enviando…';
      case 'sent':
        return `Enviada el ${formatDateTime(campaign.sentAt ?? campaign.updatedAt, zone)}`;
      case 'cancelled':
        return `Cancelada · creada el ${formatDateTime(campaign.createdAt, zone)}`;
      default:
        return `Editada el ${formatDateTime(campaign.updatedAt, zone)}`;
    }
  }

  summary(campaign: CampaignDto): string {
    return campaignStatsSummary(campaign.stats);
  }

  handleDelete(campaign: CampaignDto) {
    this.#confirm({
      title: 'Eliminar borrador',
      message: `Se elimina «${campaign.name}». No se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    })
      .pipe(switchMap(() => (this.$busy.set(campaign.id), this.#service.deleteCampaign(campaign.id))))
      .subscribe({
        next: () => {
          this.$busy.set(null);
          this.$items.update((list) => list.filter((item) => item.id !== campaign.id));
          this.#toast.show('Borrador eliminado', 'success');
        },
        error: (error: unknown) => this.#fail(error, 'No se pudo eliminar la campaña.'),
      });
  }

  handleCancel(campaign: CampaignDto) {
    const sending = campaign.status === 'sending';
    this.#confirm({
      title: sending ? 'Detener el envío' : 'Cancelar campaña',
      message: sending
        ? 'Los correos que aún no salen no se enviarán. Los que ya salieron no se pueden recuperar.'
        : 'La campaña no se enviará. Para enviarla después tendrás que crearla de nuevo.',
      confirmText: sending ? 'Detener envío' : 'Cancelar campaña',
      cancelText: 'Volver',
      tone: 'danger',
    })
      .pipe(switchMap(() => (this.$busy.set(campaign.id), this.#service.cancelCampaign(campaign.id))))
      .subscribe({
        next: (saved) => {
          this.$busy.set(null);
          this.$items.update((list) => list.map((item) => (item.id === saved.id ? saved : item)));
          this.#toast.show('Campaña cancelada', 'success');
        },
        error: (error: unknown) => this.#fail(error, 'No se pudo cancelar la campaña.'),
      });
  }

  #fail(error: unknown, fallback: string) {
    this.$busy.set(null);
    const { message } = messagingError(error, fallback);
    if (message) this.#toast.show(message, 'error');
    this.campaigns.reload();
  }

  #confirm(data: ConfirmModalData) {
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { width: '440px', maxWidth: '95vw', data })
      .afterClosed()
      .pipe(filter((confirmed) => confirmed === true));
  }
}
