import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom, Observable } from 'rxjs';
import {
  PublicApiService,
  SaveWebhookEndpointDto,
  WEBHOOK_EVENTS,
  WebhookEndpointDto,
  WebhookEndpointWithSecretDto,
} from 'src/app/modules/public-menu/data-access';
import { FULFILLMENT_ONLY_EVENTS, publicApiError, WEBHOOK_EVENT_LABELS, webhookUrlProblem } from 'src/app/modules/public-menu/features/public-api-shared';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService, ToggleComponent } from 'src/ui';

export type WebhookFormModalData = Readonly<{ endpoint?: WebhookEndpointDto }>;
/** Al crear llega con `secret` (mostrarlo una vez). */
export type WebhookFormModalResult = WebhookEndpointWithSecretDto | WebhookEndpointDto;

const DESCRIPTION_MAX = 120;

/** Crear o editar un webhook. */
@Component({
  selector: 'app-webhook-form-modal',
  imports: [ModalCardComponent, SlotDirective, ButtonComponent, ToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ endpoint ? 'Editar webhook' : 'Nuevo webhook' }}</h2>
      </ng-template>

      <form class="space-y-5 p-2" (submit)="$event.preventDefault(); handleSubmit()">
        <div>
          <label for="webhook-url" class="mb-1 block text-sm font-medium">URL *</label>
          <input
            id="webhook-url"
            type="url"
            inputmode="url"
            autocomplete="off"
            maxlength="500"
            [value]="$url()"
            (input)="$url.set($any($event.target).value)"
            (blur)="$urlTouched.set(true)"
            placeholder="https://api.tusitio.cl/webhooks/redom"
            class="glass-input w-full rounded-md px-3 py-2 font-mono text-sm"
            [class.border-red-500]="$urlError()" />
          @if ($urlError(); as error) {
          <p class="text-destructive mt-1 text-xs">{{ error }}</p>
          } @else {
          <p class="text-muted-foreground mt-1 text-xs">Una dirección https pública de tu servidor. Redom le hará POST con cada evento.</p>
          }
        </div>

        <div>
          <label for="webhook-description" class="mb-1 block text-sm font-medium">Descripción</label>
          <input
            id="webhook-description"
            type="text"
            [attr.maxlength]="descriptionMax"
            [value]="$description()"
            (input)="$description.set($any($event.target).value)"
            placeholder="Ej: Sistema de cocina, CRM"
            class="glass-input w-full rounded-md px-3 py-2" />
        </div>

        <fieldset>
          <legend class="mb-1 block text-sm font-medium">Eventos *</legend>
          <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
            @for (event of events; track event) {
            <label class="hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded-md p-2">
              <input type="checkbox" class="accent-primary mt-0.5 h-4 w-4" [checked]="$events().has(event)" (change)="toggleEvent(event)" />
              <span class="min-w-0">
                <span class="block text-sm">{{ labels[event] }}{{ fulfillmentOnly.has(event) ? ' *' : '' }}</span>
                <span class="text-muted-foreground block font-mono text-xs">{{ event }}</span>
              </span>
            </label>
            }
          </div>
          <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p class="text-muted-foreground text-xs">* Listo, en camino y entregado solo ocurren en pedidos de retiro y delivery.</p>
            <button type="button" class="text-primary text-xs font-medium hover:underline" (click)="toggleAll()">
              {{ $events().size === events.length ? 'Quitar todos' : 'Elegir todos' }}
            </button>
          </div>
          @if ($submitted() && !$events().size) {
          <p class="text-destructive mt-1 text-xs">Elige al menos un evento.</p>
          }
        </fieldset>

        <div class="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <div>
            <p class="text-sm font-medium">Activo</p>
            <p class="text-muted-foreground text-xs">Inactivo no recibe eventos.</p>
          </div>
          <app-toggle [checked]="$isActive()" (changed)="$isActive.set($event)" />
        </div>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-2">
          <app-button type="button" impact="light" tone="primary" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" tone="primary" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">
            {{ endpoint ? 'Guardar' : 'Crear webhook' }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class WebhookFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<WebhookFormModalComponent, WebhookFormModalResult>>(MatDialogRef);
  readonly #data = inject<WebhookFormModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(PublicApiService);
  readonly #toast = inject(ToastService);

  readonly endpoint = this.#data.endpoint ?? null;
  readonly events = WEBHOOK_EVENTS;
  readonly labels = WEBHOOK_EVENT_LABELS;
  readonly fulfillmentOnly = FULFILLMENT_ONLY_EVENTS;
  readonly descriptionMax = DESCRIPTION_MAX;

  readonly $url = signal(this.endpoint?.url ?? '');
  readonly $description = signal(this.endpoint?.description ?? '');
  readonly $events = signal<ReadonlySet<string>>(new Set(this.endpoint?.events ?? ['order.created']));
  readonly $isActive = signal(this.endpoint?.isActive ?? true);
  readonly $urlTouched = signal(false);
  readonly $submitted = signal(false);
  readonly $isSaving = signal(false);

  readonly $urlError = computed(() => (this.$urlTouched() || this.$submitted() ? webhookUrlProblem(this.$url()) : null));

  toggleEvent(event: string) {
    this.$events.update((set) => {
      const next = new Set(set);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  }

  toggleAll() {
    this.$events.set(this.$events().size === this.events.length ? new Set() : new Set(this.events));
  }

  async handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (webhookUrlProblem(this.$url()) || !this.$events().size) {
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    const url = this.$url().trim();
    const description = this.$description().trim() || null;
    // En el orden de la lista, no en el de los clics.
    const events = this.events.filter((event) => this.$events().has(event));
    const isActive = this.$isActive();
    this.$isSaving.set(true);
    try {
      let saved: WebhookFormModalResult;
      if (this.endpoint) {
        const dto: { -readonly [K in keyof SaveWebhookEndpointDto]: SaveWebhookEndpointDto[K] } = {};
        if (url !== this.endpoint.url) dto.url = url;
        if (description !== (this.endpoint.description || null)) dto.description = description;
        if (events.join() !== this.events.filter((event) => this.endpoint!.events.includes(event)).join()) dto.events = events;
        if (isActive !== this.endpoint.isActive) dto.isActive = isActive;
        if (!Object.keys(dto).length) {
          this.dialogRef.close();
          return;
        }
        saved = await firstValueFrom(this.#service.updateWebhook(this.endpoint.id, dto));
        this.#toast.show('Webhook actualizado', 'success');
      } else {
        saved = await firstValueFrom(this.#service.createWebhook({ url, description, events, isActive }));
        this.#toast.show('Webhook creado', 'success');
      }
      this.dialogRef.close(saved);
    } catch (error) {
      this.$isSaving.set(false);
      const message = publicApiError(error, 'No se pudo guardar el webhook.');
      if (message) this.#toast.show(message, 'error');
    }
  }
}

export function openWebhookFormModal(dialog: MatDialog, data: WebhookFormModalData = {}): Observable<WebhookFormModalResult | undefined> {
  return dialog
    .open<WebhookFormModalComponent, WebhookFormModalData, WebhookFormModalResult>(WebhookFormModalComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
