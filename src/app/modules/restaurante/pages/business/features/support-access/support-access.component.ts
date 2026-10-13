import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  ButtonComponent,
  CardComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  IconComponent,
  PaginationTableComponent,
  SkeletonComponent,
  ToastService,
} from 'src/ui';
import {
  SUPPORT_ACCESS_DAYS,
  SupportAccessDays,
  SupportAccessService,
  SupportEventDto,
  SupportEventType,
  SupportGrantDto,
} from '../../data-access';

const EVENTS_PER_PAGE = 10;
const NOTE_MAX_LENGTH = 500;
const DEFAULT_DAYS: SupportAccessDays = 7;

const EVENT_LABELS: Partial<Record<SupportEventType, string>> = {
  granted: 'Autorizaste el acceso',
  extended: 'Extendiste el acceso',
  used: 'Redom comenzó a trabajar',
  revoked: 'Acceso terminado',
  expired: 'Acceso vencido',
};

const EVENT_ICONS: Record<SupportEventType, string> = {
  granted: 'key',
  extended: 'more_time',
  used: 'login',
  revoked: 'block',
  expired: 'timer_off',
  entity_created: 'add',
  entity_updated: 'edit',
  entity_deleted: 'delete',
  email_failed: 'mail',
};

export const SUPPORT_INCLUDED = [
  'Productos, ingredientes y preparaciones',
  'Categorías y subcategorías',
  'Marcas y unidades',
  'Modificadores',
  'Imágenes',
  'Recetas y food cost',
  'Productos por estación',
  'QR de las mesas',
];

export const SUPPORT_EXCLUDED = ['Ventas y pedidos', 'Pagos y caja', 'Finanzas', 'Clientes', 'Stock y compras', 'Usuarios', 'Configuración'];

function supportErrorMessage(error: unknown): string {
  const apiError = readApiError(error);
  if (apiError.code === 'SUPPORT_ACCESS_INVALID_DAYS') return 'Elige 1, 3, 7, 14 o 30 días';
  if (apiError.status === 0) return 'No hay conexión con el servidor.';
  return apiError.message || 'No se pudo completar la operación';
}

/** Pestaña "Soporte" de Mi negocio: el dueño autoriza a Redom a gestionar su carta por unos días. */
@Component({
  selector: 'app-support-access',
  imports: [NgTemplateOutlet, CardComponent, ButtonComponent, IconComponent, SkeletonComponent, PaginationTableComponent],
  templateUrl: './support-access.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportAccessComponent {
  readonly #service = inject(SupportAccessService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);
  readonly #dialog = inject(MatDialog);

  /** El backend respondió que solo el dueño puede ver esto: el padre oculta la pestaña. */
  readonly ownerRequired = output<void>();

  readonly dayOptions = SUPPORT_ACCESS_DAYS;
  readonly noteMaxLength = NOTE_MAX_LENGTH;
  readonly included = SUPPORT_INCLUDED;
  readonly excluded = SUPPORT_EXCLUDED;

  readonly $days = signal<SupportAccessDays>(DEFAULT_DAYS);
  readonly $note = signal('');
  readonly $isSaving = signal(false);
  readonly $isExtending = signal(false);
  // Acceso del historial cuya actividad se está viendo (null = el vigente).
  readonly $selectedGrantId = signal<number | null>(null);
  readonly $page = signal(1);

  readonly state = rxResource({
    stream: () => this.#service.getState().pipe(toRemoteResult()),
  });

  readonly $state = computed(() => resultValue(this.state.value()));
  readonly $active = computed(() => this.$state()?.active ?? null);
  readonly $history = computed(() => this.$state()?.history ?? []);
  readonly $hasError = computed(() => {
    const error = resultError(this.state.value());
    return !!error && readApiError(error).code !== 'SUPPORT_ACCESS_OWNER_REQUIRED';
  });
  readonly $isOwnerRequired = computed(() => readApiError(resultError(this.state.value())).code === 'SUPPORT_ACCESS_OWNER_REQUIRED');

  readonly $activityGrant = computed<SupportGrantDto | null>(() => {
    const selected = this.$selectedGrantId();
    if (selected !== null) return this.$history().find((grant) => grant.id === selected) ?? null;
    return this.$active();
  });

  readonly events = rxResource({
    params: () => {
      const grant = this.$activityGrant();
      return grant ? { grantId: grant.id, page: this.$page() } : undefined;
    },
    stream: ({ params }) =>
      this.#service.getEvents({ grantId: params.grantId, page: params.page, perPage: EVENTS_PER_PAGE }).pipe(toRemoteResult()),
  });

  readonly $events = computed(() => (resultValue(this.events.value())?.data ?? []).filter((event) => event.type !== 'email_failed'));
  readonly $eventsPagination = computed(() => resultValue(this.events.value())?.pagination ?? null);
  readonly $eventsError = computed(() => !!resultError(this.events.value()));

  // Fechas en la zona horaria del negocio (si no se conoce o es inválida, la de Chile).
  readonly #dateFormat = computed(() => {
    const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
    try {
      return new Intl.DateTimeFormat('es-CL', { ...options, timeZone: this.#settings.$settings()?.timeZone || 'America/Santiago' });
    } catch {
      return new Intl.DateTimeFormat('es-CL', { ...options, timeZone: 'America/Santiago' });
    }
  });

  constructor() {
    // Un 403 por no ser dueño no es un error de la pantalla: se avisa al padre para ocultar la pestaña.
    effect(() => {
      if (this.$isOwnerRequired()) untracked(() => this.ownerRequired.emit());
    });
  }

  formatDate(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : this.#dateFormat().format(date);
  }

  eventLabel(event: SupportEventDto): string {
    return event.summary || EVENT_LABELS[event.type] || '';
  }

  eventIcon(event: SupportEventDto): string {
    return EVENT_ICONS[event.type] ?? 'history';
  }

  endReason(grant: SupportGrantDto): string {
    if (grant.endReason === 'revoked') return grant.endedByName ? `Terminado por ${grant.endedByName}` : 'Terminado';
    if (grant.endReason === 'expired') return 'Vencido';
    return '';
  }

  changesText(grant: SupportGrantDto): string {
    const { created, updated, deleted } = grant.changes;
    if (!created && !updated && !deleted) return 'Sin cambios';
    return `${created} creados · ${updated} editados · ${deleted} eliminados`;
  }

  updateNote(event: Event) {
    this.$note.set((event.target as HTMLTextAreaElement).value.slice(0, NOTE_MAX_LENGTH));
  }

  retry() {
    this.#reload();
  }

  startExtend() {
    this.$days.set(DEFAULT_DAYS);
    this.$note.set('');
    this.$isExtending.set(true);
  }

  cancelExtend() {
    this.$isExtending.set(false);
  }

  selectGrant(grantId: number) {
    this.$selectedGrantId.update((current) => (current === grantId ? null : grantId));
    this.$page.set(1);
  }

  showActiveActivity() {
    this.$selectedGrantId.set(null);
    this.$page.set(1);
  }

  changePage(page: number) {
    this.$page.set(page);
  }

  grant() {
    if (this.$isSaving()) return;
    const extending = !!this.$active();
    const note = this.$note().trim();
    this.$isSaving.set(true);
    this.#service.grant({ days: this.$days(), ...(note ? { note } : {}) }).subscribe({
      next: (grant) => {
        this.$isSaving.set(false);
        this.$isExtending.set(false);
        this.$note.set('');
        this.#toast.show(
          extending ? `Extendiste el acceso hasta ${this.formatDate(grant.expiresAt)}` : `Autorizaste a Redom hasta ${this.formatDate(grant.expiresAt)}`,
          'success',
        );
        this.#reload();
      },
      error: (error) => {
        this.$isSaving.set(false);
        this.#toast.show(supportErrorMessage(error), 'error');
      },
    });
  }

  confirmRevoke() {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Terminar acceso',
          message: 'Redom dejará de poder gestionar tu carta desde ahora. Los cambios que ya hizo se mantienen.',
          confirmText: 'Terminar acceso',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.#revoke();
      });
  }

  #revoke() {
    this.$isSaving.set(true);
    this.#service.revoke().subscribe({
      next: () => {
        this.$isSaving.set(false);
        this.#toast.show('Terminaste el acceso de Redom', 'success');
        this.#reload();
      },
      error: (error) => {
        this.$isSaving.set(false);
        // Ya había terminado (lo cortó Redom o venció): solo se refresca.
        if (readApiError(error).code === 'SUPPORT_ACCESS_NOT_FOUND') {
          this.#reload();
          return;
        }
        this.#toast.show(supportErrorMessage(error), 'error');
      },
    });
  }

  #reload() {
    // reload() conserva lo que se ve mientras llega la respuesta.
    this.$page.set(1);
    this.state.reload();
    this.events.reload();
  }
}
