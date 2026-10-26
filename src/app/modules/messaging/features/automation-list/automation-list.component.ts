import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  AUTOMATION_INFO,
  AutomationDefaultsStore,
  AutomationDto,
  AutomationType,
  isFeatureNotIncluded,
  messagingError,
  MessagingService,
} from 'src/app/modules/messaging/data-access';
import { openAutomationEditorModal } from 'src/app/modules/messaging/features/automation-editor-modal';
import { HelpLinksComponent, MESSAGING_HELP } from 'src/app/modules/messaging/features/template-tools';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { ButtonComponent, IconComponent, ToastService, ToggleComponent } from 'src/ui';

/** Pestaña "Automáticos": las 4 automatizaciones, cada una con su interruptor y su editor. */
@Component({
  selector: 'app-automation-list',
  imports: [ButtonComponent, IconComponent, ToggleComponent, HelpLinksComponent, MarketingUpsellCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './automation-list.component.html',
})
export class AutomationListComponent {
  readonly #service = inject(MessagingService);
  readonly #defaults = inject(AutomationDefaultsStore);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly info = AUTOMATION_INFO;
  readonly helpLinks = [MESSAGING_HELP.automations, MESSAGING_HELP.unsubscribes];
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.MESSAGING.MANAGE_AUTOMATIONS));

  readonly automations = rxResource({ stream: () => this.#service.getAutomations().pipe(toRemoteResult()) });
  readonly $items = linkedSignal(() => resultValue(this.automations.value()) ?? []);
  readonly $planBlocked = computed(() => isFeatureNotIncluded(resultError(this.automations.value())));
  readonly $error = computed(() => {
    const error = resultError(this.automations.value());
    return error && !this.$planBlocked() ? messagingError(error, 'No se pudieron cargar los mensajes automáticos.').message : null;
  });
  readonly $saving = signal<ReadonlySet<AutomationType>>(new Set());

  constructor() {
    effect(() => {
      const list = resultValue(this.automations.value());
      if (list) this.#defaults.remember(list);
    });
  }

  summary(automation: AutomationDto): string {
    const parts: string[] = [];
    if (automation.type === 'postVisitSurvey') parts.push(`${automation.delayHours} h después de la visita`);
    if (automation.type === 'loyaltyPointsExpiring') parts.push(`${automation.daysBefore} días antes del vencimiento`);
    parts.push(`no se repite antes de ${automation.cooldownDays} días`);
    return parts.join(' · ');
  }

  isSaving(type: AutomationType): boolean {
    return this.$saving().has(type);
  }

  toggle(automation: AutomationDto, isEnabled: boolean) {
    if (this.isSaving(automation.type) || !this.$canManage()) return;
    this.#replace({ ...automation, isEnabled });
    this.#setSaving(automation.type, true);
    this.#service.updateAutomation(automation.type, { isEnabled }).subscribe({
      next: (saved) => {
        this.#setSaving(automation.type, false);
        this.#replace(saved);
        this.#toast.show(isEnabled ? `«${this.info[saved.type].title}» activado` : `«${this.info[saved.type].title}» apagado`, 'success');
      },
      error: (error: unknown) => {
        this.#setSaving(automation.type, false);
        this.#replace(automation);
        const { message } = messagingError(error, 'No se pudo cambiar el estado.');
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  edit(automation: AutomationDto) {
    openAutomationEditorModal(this.#dialog, {
      automation,
      defaults: this.#defaults.get(automation.type),
      canManage: this.$canManage(),
      onSaved: (saved) => this.#replace(saved),
    });
  }

  #replace(automation: AutomationDto) {
    this.$items.update((list) => list.map((item) => (item.type === automation.type ? automation : item)));
  }

  #setSaving(type: AutomationType, saving: boolean) {
    this.$saving.update((set) => {
      const next = new Set(set);
      if (saving) next.add(type);
      else next.delete(type);
      return next;
    });
  }
}
