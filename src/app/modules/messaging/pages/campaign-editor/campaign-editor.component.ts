import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map, startWith } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { FileUploadService, getUploadErrorMessage, ImageSelection, ImageUploadError } from 'src/app/core/services/file-upload';
import { HasUnsavedChanges, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_STAT_ITEMS,
  CAMPAIGN_STATUS_CLASSES,
  CAMPAIGN_STATUS_LABELS,
  CampaignAudienceDto,
  CampaignDto,
  campaignRate,
  CTA_LABEL_MAX,
  CTA_URL_MAX,
  formatDateTime,
  formatNumber,
  fromDateTimeInput,
  HTTPS_URL,
  isCampaignEditable,
  isCampaignLocked,
  messagingError,
  MessagingService,
  PREHEADER_MAX,
  PreviewDto,
  SaveCampaignDto,
  SCHEDULE_MAX_DAYS,
  Segment,
  SEGMENT_LABELS,
  SEGMENTS,
  SUBJECT_MAX,
  TemplateVariable,
  toDateTimeInput,
} from 'src/app/modules/messaging/data-access';
import { EmailPreviewComponent } from 'src/app/modules/messaging/features/email-preview';
import { MessagingQuotaComponent } from 'src/app/modules/messaging/features/messaging-quota';
import { HelpLinksComponent, insertAtCursor, MESSAGING_HELP, TemplateVariablesComponent } from 'src/app/modules/messaging/features/template-tools';
import { openTestSendModal } from 'src/app/modules/messaging/features/test-send-modal';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  HeaderDashboardComponent,
  IconComponent,
  ImagePickerComponent,
  ToastService,
  ToggleComponent,
} from 'src/ui';

type TextField = 'subject' | 'preheader' | 'body' | 'ctaLabel';
type Field = 'name' | TextField | 'ctaUrl' | 'imageFileId' | 'segments' | 'locationId' | 'scheduledAt';

const REFRESH_MS = 30_000;
const FIELD_ALIASES: Record<string, Field> = { 'audience.segments': 'segments', 'audience.locationId': 'locationId', audience: 'segments' };

/**
 * Crear, editar y enviar una campaña (/messaging/campaigns/new o /:id). Borrador y programada se editan; enviada,
 * enviándose o cancelada se ven en modo lectura con sus estadísticas. La audiencia, la vista previa y la prueba
 * usan lo guardado: antes de probar o enviar se guarda lo pendiente.
 */
@Component({
  selector: 'app-campaign-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    ToggleComponent,
    ImagePickerComponent,
    EmailPreviewComponent,
    MessagingQuotaComponent,
    TemplateVariablesComponent,
    HelpLinksComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaign-editor.component.html',
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class CampaignEditorComponent implements HasUnsavedChanges {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #service = inject(MessagingService);
  readonly #upload = inject(FileUploadService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #business = inject(BusinessSettingsService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #fb = inject(FormBuilder);
  private readonly subjectRef = viewChild<ElementRef<HTMLInputElement>>('subjectInput');
  private readonly preheaderRef = viewChild<ElementRef<HTMLInputElement>>('preheaderInput');
  private readonly bodyRef = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');
  private readonly ctaRef = viewChild<ElementRef<HTMLInputElement>>('ctaInput');

  readonly max = { name: CAMPAIGN_NAME_MAX, subject: SUBJECT_MAX, preheader: PREHEADER_MAX, body: CAMPAIGN_BODY_MAX, cta: CTA_LABEL_MAX, url: CTA_URL_MAX };
  readonly segments = SEGMENTS;
  readonly segmentLabels = SEGMENT_LABELS;
  readonly statusLabels = CAMPAIGN_STATUS_LABELS;
  readonly statusClasses = CAMPAIGN_STATUS_CLASSES;
  readonly statItems = CAMPAIGN_STAT_ITEMS;
  readonly helpLinks = [MESSAGING_HELP.campaigns, MESSAGING_HELP.unsubscribes];
  readonly scheduleMaxDays = SCHEDULE_MAX_DAYS;
  readonly $uploading = this.#upload.$isUploading;
  readonly $progress = this.#upload.$progress;

  readonly $canSend = computed(() => this.#access.can(PERMISSIONS.MESSAGING.SEND_CAMPAIGNS));
  readonly $timeZone = computed(() => this.#business.$settings()?.timeZone ?? null);

  // --- Campaña ---
  readonly #idParam = toSignal(this.#route.paramMap.pipe(map((params) => params.get('id'))), { initialValue: null });
  readonly $id = computed(() => {
    const raw = this.#idParam();
    const id = Number(raw);
    return raw !== 'new' && Number.isInteger(id) && id > 0 ? id : null;
  });
  readonly $isNew = computed(() => this.#idParam() === 'new');
  readonly campaignResource = rxResource({
    params: () => this.$id() ?? undefined,
    stream: ({ params }) => this.#service.getCampaign(params).pipe(toRemoteResult()),
  });
  readonly $campaign = signal<CampaignDto | null>(null);
  readonly $loadError = computed(() => {
    const error = resultError(this.campaignResource.value());
    return error ? messagingError(error, 'No se pudo cargar la campaña.').message : null;
  });
  readonly $notFound = computed(() => {
    const value = this.campaignResource.value();
    return !!value?.ok && value.value === null;
  });
  readonly $status = computed(() => this.$campaign()?.status ?? 'draft');
  readonly $locked = signal(false);
  readonly $editable = computed(() => this.$canSend() && !this.$locked() && isCampaignEditable(this.$status()));
  readonly $hasStats = computed(() => !isCampaignEditable(this.$status()));

  // --- Formulario ---
  readonly form = this.#fb.nonNullable.group({
    name: [''],
    subject: [''],
    preheader: [''],
    body: [''],
    ctaLabel: [''],
    ctaUrl: [''],
    locationId: [''],
    onlyVerified: [false],
  });
  readonly $value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  readonly $segments = signal<ReadonlySet<Segment>>(new Set());
  readonly #image = signal<ImageSelection>({ kind: 'keep' });
  readonly $imageKey = signal(0);
  readonly $lastText = signal<TextField>('body');
  readonly $submitted = signal(false);
  readonly $serverErrors = signal<Partial<Record<Field, string>>>({});
  readonly $invalidVariable = signal<string | null>(null);
  readonly $problems = computed(() => this.#problems());
  readonly $dirty = computed(() => this.#image().kind !== 'keep' || Object.keys(this.#changes()).length > 0);

  // --- Audiencia y vista previa (de lo guardado) ---
  readonly $audience = signal<CampaignAudienceDto | null>(null);
  readonly $audienceLoading = signal(false);
  readonly $audienceError = signal<string | null>(null);
  readonly $preview = signal<PreviewDto | null>(null);
  readonly $previewLoading = signal(false);
  readonly $previewError = signal<string | null>(null);

  // --- Envío ---
  readonly $sendMode = signal<'now' | 'later'>('now');
  readonly $scheduleInput = signal('');
  readonly $busy = signal<'save' | 'send' | 'schedule' | 'cancel' | 'delete' | 'test' | null>(null);
  readonly $sendError = signal<string | null>(null);

  readonly locations = rxResource({ stream: () => this.#service.getLocations().pipe(toRemoteResult()) });
  readonly $locations = computed(() => resultValue(this.locations.value()) ?? []);

  #loadedId: number | null = null;
  #leaving = false;

  constructor() {
    // Al llegar la campaña (o al cambiar de id) se carga el formulario; los refrescos solo actualizan estado y estadísticas.
    effect(() => {
      const campaign = resultValue(this.campaignResource.value());
      if (!campaign) return;
      untracked(() => {
        if (campaign.id !== this.#loadedId) {
          this.#reset(campaign);
          if (isCampaignEditable(campaign.status)) this.loadAudience();
          this.loadPreview();
        } else {
          this.$campaign.set(campaign);
        }
      });
    });
    effect((onCleanup) => {
      if (this.$status() !== 'sending') return;
      const timer = setInterval(() => {
        if (document.visibilityState === 'visible' && !this.campaignResource.isLoading()) this.campaignResource.reload();
      }, REFRESH_MS);
      onCleanup(() => clearInterval(timer));
    });
    effect(() => {
      const editable = this.$editable();
      untracked(() => (editable ? this.form.enable({ emitEvent: false }) : this.form.disable({ emitEvent: false })));
    });
  }

  // --- Lectura ---

  show(field: Field): string | null {
    const server = this.$serverErrors()[field];
    if (server) return server;
    const problem = this.$problems()[field] ?? null;
    if (!problem) return null;
    if (this.$submitted()) return problem;
    const control = (this.form.controls as Record<string, { touched: boolean }>)[field];
    return control?.touched ? problem : null;
  }

  dateLine(): string {
    const campaign = this.$campaign();
    if (!campaign) return '';
    const zone = this.$timeZone();
    if (campaign.status === 'scheduled') return `Programada para el ${formatDateTime(campaign.scheduledAt, zone)}`;
    if (campaign.status === 'sent') return `Enviada el ${formatDateTime(campaign.sentAt, zone)}`;
    if (campaign.status === 'sending') return 'Enviándose: los números se actualizan cada 30 segundos.';
    if (campaign.status === 'cancelled') return 'Cancelada';
    return `Borrador · editado el ${formatDateTime(campaign.updatedAt, zone)}`;
  }

  stat(key: string): string {
    const value = (this.$campaign()?.stats as Record<string, number | undefined> | undefined)?.[key];
    return value === undefined ? '—' : formatNumber(value);
  }

  rate(key: string): string | null {
    if (key !== 'opened' && key !== 'clicked' && key !== 'unsubscribed') return null;
    const stats = (this.$campaign()?.stats ?? {}) as Record<string, number | undefined>;
    return campaignRate(stats[key], stats['sent']);
  }

  audienceText(audience: CampaignAudienceDto): string {
    const n = audience.recipients;
    return `Llegará a ${formatNumber(n)} ${n === 1 ? 'cliente' : 'clientes'}.`;
  }

  excludedText(audience: CampaignAudienceDto): string | null {
    const { noConsent, noEmail, suppressed, unsubscribed } = audience.excluded;
    const parts = [
      noConsent ? `${formatNumber(noConsent)} sin aceptar novedades` : null,
      noEmail ? `${formatNumber(noEmail)} sin correo` : null,
      suppressed ? `${formatNumber(suppressed)} con correo con problemas` : null,
      unsubscribed ? `${formatNumber(unsubscribed)} ${unsubscribed === 1 ? 'dado de baja' : 'dados de baja'}` : null,
    ].filter((part): part is string => !!part);
    return parts.length ? `No incluye: ${parts.join(', ')}.` : null;
  }

  audienceSummary(): string {
    const v = this.$value();
    const segments = [...this.$segments()];
    const who = segments.length ? segments.map((segment) => SEGMENT_LABELS[segment]).join(', ') : 'Todos los segmentos';
    const location = v.locationId ? (this.$locations().find((item) => String(item.id) === v.locationId)?.name ?? 'Un local') : 'Todos los locales';
    return `${who} · ${location}${v.onlyVerified ? ' · Solo reconocidos' : ''}`;
  }

  readonly $scheduleBounds = computed(() => {
    const zone = this.$timeZone();
    const now = new Date();
    return { min: toDateTimeInput(now, zone), max: toDateTimeInput(new Date(now.getTime() + SCHEDULE_MAX_DAYS * 86_400_000), zone) };
  });

  // --- Edición ---

  focusText(field: TextField) {
    this.$lastText.set(field);
  }

  insertVariable(variable: TemplateVariable) {
    const field = this.$lastText();
    const refs = { subject: this.subjectRef, preheader: this.preheaderRef, body: this.bodyRef, ctaLabel: this.ctaRef };
    insertAtCursor(refs[field]()?.nativeElement ?? null, this.form.controls[field], `{{${variable}}}`);
    this.onInput(field);
  }

  onInput(field: Field) {
    if (field === 'subject' || field === 'preheader' || field === 'body' || field === 'ctaLabel') this.$invalidVariable.set(null);
    if (!this.$serverErrors()[field]) return;
    this.$serverErrors.update((errors) => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }

  toggleSegment(segment: Segment) {
    if (!this.$editable()) return;
    this.$segments.update((set) => {
      const next = new Set(set);
      if (next.has(segment)) next.delete(segment);
      else next.add(segment);
      return next;
    });
    this.onInput('segments');
  }

  clearSegments() {
    this.$segments.set(new Set());
    this.onInput('segments');
  }

  onImage(selection: ImageSelection) {
    this.#image.set(selection);
    this.onInput('imageFileId');
  }

  onScheduleInput(event: Event) {
    this.$scheduleInput.set((event.target as HTMLInputElement).value);
    this.onInput('scheduledAt');
    this.$sendError.set(null);
  }

  setSendMode(mode: 'now' | 'later') {
    this.$sendMode.set(mode);
    this.$sendError.set(null);
  }

  loadAudience() {
    const id = this.$campaign()?.id;
    if (!id) return;
    this.$audienceLoading.set(true);
    this.$audienceError.set(null);
    this.#service.getAudience(id).subscribe({
      next: (audience) => {
        this.$audience.set(audience);
        this.$audienceLoading.set(false);
      },
      error: (error: unknown) => {
        this.$audienceLoading.set(false);
        this.$audienceError.set(messagingError(error, 'No se pudo calcular la audiencia.').message ?? 'Audiencia no disponible.');
      },
    });
  }

  loadPreview() {
    const id = this.$campaign()?.id;
    if (!id) return;
    this.$previewLoading.set(true);
    this.$previewError.set(null);
    this.#service.previewCampaign(id).subscribe({
      next: (preview) => {
        this.$preview.set(preview);
        this.$previewLoading.set(false);
      },
      error: (error: unknown) => {
        this.$previewLoading.set(false);
        this.$previewError.set(messagingError(error, 'No se pudo cargar la vista previa.').message ?? 'Vista previa no disponible.');
      },
    });
  }

  // --- Acciones ---

  async handleSave() {
    if (this.$busy()) return;
    this.$busy.set('save');
    const saved = await this.#saveIfNeeded(true);
    this.$busy.set(null);
    if (saved) this.#toast.show('Campaña guardada', 'success');
  }

  async handleTest() {
    if (this.$busy()) return;
    this.$busy.set('test');
    const campaign = await this.#saveIfNeeded();
    this.$busy.set(null);
    if (!campaign) return;
    openTestSendModal(this.#dialog, { title: campaign.name, send: (email) => this.#service.testCampaign(campaign.id, email) });
  }

  async handleSend() {
    if (this.$busy()) return;
    this.$sendError.set(null);
    const later = this.$sendMode() === 'later';
    let scheduledAt: string | undefined;
    if (later) {
      const problem = this.#scheduleProblem();
      if (problem) {
        this.$serverErrors.update((errors) => ({ ...errors, scheduledAt: problem }));
        return;
      }
      scheduledAt = fromDateTimeInput(this.$scheduleInput(), this.$timeZone()) ?? undefined;
    }
    this.$busy.set(later ? 'schedule' : 'send');
    try {
      const campaign = await this.#saveIfNeeded();
      if (!campaign) return;
      const audience = await firstValueFrom(this.#service.getAudience(campaign.id));
      this.$audience.set(audience);
      if (!audience.recipients) {
        this.$sendError.set('Ningún cliente cumple con la audiencia elegida.');
        return;
      }
      const n = `${formatNumber(audience.recipients)} ${audience.recipients === 1 ? 'cliente' : 'clientes'}`;
      const confirmed = await firstValueFrom(
        this.#confirm({
          title: later ? 'Programar campaña' : 'Enviar campaña',
          message: later
            ? `Se enviará a ${n} el ${formatDateTime(scheduledAt, this.$timeZone())}. Hasta entonces puedes cambiarla o cancelarla.`
            : `Se envía ahora y no se puede deshacer. ${this.excludedText(audience) ?? ''}`.trim(),
          confirmText: later ? `Programar para ${n}` : `Enviar a ${n} ahora`,
          cancelText: 'Volver',
        }),
      );
      if (!confirmed) return;
      const sent = await firstValueFrom(this.#service.sendCampaign(campaign.id, scheduledAt));
      this.$campaign.set(sent);
      this.#entitlements.refresh();
      this.#toast.show(sent.status === 'scheduled' ? 'Campaña programada' : 'Campaña en envío: los correos salen en unos minutos', 'success');
    } catch (error) {
      this.#handleError(error, 'No se pudo enviar la campaña.', true);
    } finally {
      this.$busy.set(null);
    }
  }

  handleCancel() {
    const campaign = this.$campaign();
    if (!campaign || this.$busy()) return;
    const sending = campaign.status === 'sending';
    this.#confirm({
      title: sending ? 'Detener el envío' : 'Cancelar campaña',
      message: sending
        ? 'Los correos que aún no salen no se enviarán. Los que ya salieron no se pueden recuperar.'
        : 'La campaña no se enviará. Para enviarla después tendrás que crearla de nuevo.',
      confirmText: sending ? 'Detener envío' : 'Cancelar campaña',
      cancelText: 'Volver',
      tone: 'danger',
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.$busy.set('cancel');
      this.#service.cancelCampaign(campaign.id).subscribe({
        next: (saved) => {
          this.$busy.set(null);
          this.$campaign.set(saved);
          this.#toast.show('Campaña cancelada', 'success');
        },
        error: (error: unknown) => {
          this.$busy.set(null);
          this.#handleError(error, 'No se pudo cancelar la campaña.');
        },
      });
    });
  }

  handleDelete() {
    const campaign = this.$campaign();
    if (!campaign || this.$busy()) return;
    this.#confirm({
      title: 'Eliminar borrador',
      message: `Se elimina «${campaign.name}». No se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      tone: 'danger',
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.$busy.set('delete');
      this.#service.deleteCampaign(campaign.id).subscribe({
        next: () => {
          this.#toast.show('Borrador eliminado', 'success');
          this.#leaving = true;
          this.#router.navigate(['/messaging'], { queryParams: { tab: 'campaigns' } });
        },
        error: (error: unknown) => {
          this.$busy.set(null);
          this.#handleError(error, 'No se pudo eliminar la campaña.');
        },
      });
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.#leaving && this.$editable() && this.$dirty();
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  // --- Internos ---

  /** Guarda lo pendiente (o crea la campaña). Devuelve la campaña guardada; null si no se pudo. */
  async #saveIfNeeded(explicit = false): Promise<CampaignDto | null> {
    const current = this.$campaign();
    if (current && !this.$dirty()) {
      if (explicit) this.#toast.show('No hay cambios por guardar', 'warning');
      return explicit ? null : current;
    }
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return null;
    }
    try {
      const imageFileId = await this.#upload.resolveSelection(this.#image(), 'menu_banners');
      const changes = this.#changes();
      if (imageFileId !== undefined) changes.imageFileId = imageFileId;
      const saved = current
        ? await firstValueFrom(this.#service.updateCampaign(current.id, changes))
        : await firstValueFrom(this.#service.createCampaign(changes));
      this.#reset(saved);
      if (!current) {
        // Pasa de /new a /:id sin recargar el formulario.
        this.#leaving = true;
        await this.#router.navigate(['/messaging/campaigns', saved.id], { replaceUrl: true });
        this.#leaving = false;
      }
      this.loadAudience();
      this.loadPreview();
      return saved;
    } catch (error) {
      if (error instanceof ImageUploadError) {
        this.#toast.show(getUploadErrorMessage(error), 'error');
        return null;
      }
      this.#handleError(error, 'No se pudo guardar la campaña.');
      return null;
    }
  }

  #handleError(error: unknown, fallback: string, sending = false) {
    const { message, field, variable } = messagingError(error, fallback);
    if (isCampaignLocked(error)) {
      this.$locked.set(true);
      this.campaignResource.reload();
    }
    const key = field ? (FIELD_ALIASES[field] ?? (field as Field)) : null;
    if (key) this.$serverErrors.update((errors) => ({ ...errors, [key]: message ?? '' }));
    this.$invalidVariable.set(variable ?? null);
    if (sending && message && !key) this.$sendError.set(message);
    if (message) this.#toast.show(message, 'error');
  }

  #reset(campaign: CampaignDto) {
    this.#loadedId = campaign.id;
    this.$campaign.set(campaign);
    this.form.reset(
      {
        name: campaign.name,
        subject: campaign.subject,
        preheader: campaign.preheader ?? '',
        body: campaign.body,
        ctaLabel: campaign.ctaLabel ?? '',
        ctaUrl: campaign.ctaUrl ?? '',
        locationId: campaign.audience.locationId ? String(campaign.audience.locationId) : '',
        onlyVerified: campaign.audience.onlyVerified,
      },
      { emitEvent: true },
    );
    this.$segments.set(new Set(campaign.audience.segments));
    this.#image.set({ kind: 'keep' });
    this.$imageKey.update((key) => key + 1);
    this.$submitted.set(false);
    this.$serverErrors.set({});
    this.$invalidVariable.set(null);
    this.$locked.set(false);
    if (campaign.status === 'scheduled' && campaign.scheduledAt) {
      this.$sendMode.set('later');
      this.$scheduleInput.set(toDateTimeInput(campaign.scheduledAt, this.$timeZone()));
    }
  }

  #changes(): SaveCampaignDto {
    const v = this.$value();
    const current = this.$campaign();
    const next = {
      name: v.name.trim(),
      subject: v.subject.trim(),
      preheader: v.preheader.trim() || null,
      body: v.body.trim(),
      ctaLabel: v.ctaLabel.trim() || null,
      ctaUrl: v.ctaUrl.trim() || null,
    };
    const audience = { segments: [...this.$segments()], locationId: v.locationId ? Number(v.locationId) : null, onlyVerified: v.onlyVerified };
    if (!current) return { ...next, audience };
    const changes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next)) if (value !== current[key as keyof typeof next]) changes[key] = value;
    const sameSegments =
      audience.segments.length === current.audience.segments.length && audience.segments.every((segment) => current.audience.segments.includes(segment));
    if (!sameSegments || audience.locationId !== current.audience.locationId || audience.onlyVerified !== current.audience.onlyVerified)
      changes['audience'] = audience;
    return changes as SaveCampaignDto;
  }

  #problems(): Partial<Record<Field, string>> {
    const v = this.$value();
    const problems: Partial<Record<Field, string>> = {};
    if (!v.name.trim()) problems.name = 'Escribe un nombre para reconocerla.';
    else if (v.name.trim().length > CAMPAIGN_NAME_MAX) problems.name = `Hasta ${CAMPAIGN_NAME_MAX} caracteres.`;
    if (!v.subject.trim()) problems.subject = 'Escribe el asunto.';
    else if (v.subject.length > SUBJECT_MAX) problems.subject = `Hasta ${SUBJECT_MAX} caracteres.`;
    if (v.preheader.length > PREHEADER_MAX) problems.preheader = `Hasta ${PREHEADER_MAX} caracteres.`;
    if (!v.body.trim()) problems.body = 'Escribe el mensaje.';
    else if (v.body.length > CAMPAIGN_BODY_MAX) problems.body = `Hasta ${CAMPAIGN_BODY_MAX} caracteres.`;
    if (v.ctaLabel.length > CTA_LABEL_MAX) problems.ctaLabel = `Hasta ${CTA_LABEL_MAX} caracteres.`;
    const url = v.ctaUrl.trim();
    if (url && (!HTTPS_URL.test(url) || url.length > CTA_URL_MAX)) problems.ctaUrl = 'Ingresa una dirección que empiece con https://';
    return problems;
  }

  #scheduleProblem(): string | null {
    const iso = fromDateTimeInput(this.$scheduleInput(), this.$timeZone());
    if (!iso) return 'Elige la fecha y la hora.';
    const time = new Date(iso).getTime();
    if (time <= Date.now()) return 'Elige una fecha y hora que todavía no pase.';
    if (time > Date.now() + SCHEDULE_MAX_DAYS * 86_400_000) return `Hasta ${SCHEDULE_MAX_DAYS} días desde hoy.`;
    return null;
  }

  #confirm(data: ConfirmModalData) {
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { width: '460px', maxWidth: '95vw', data })
      .afterClosed()
      .pipe(map((confirmed) => confirmed === true));
  }
}
