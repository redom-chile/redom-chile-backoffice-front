import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom, map, startWith } from 'rxjs';
import {
  AUTOMATION_BODY_MAX,
  AUTOMATION_INFO,
  AutomationDto,
  AutomationTexts,
  CTA_LABEL_MAX,
  messagingError,
  MessagingService,
  PreviewDto,
  RANGES,
  SUBJECT_MAX,
  TemplateVariable,
  UpdateAutomationDto,
} from 'src/app/modules/messaging/data-access';
import { EmailPreviewComponent } from 'src/app/modules/messaging/features/email-preview';
import { insertAtCursor, TemplateVariablesComponent } from 'src/app/modules/messaging/features/template-tools';
import { openTestSendModal } from 'src/app/modules/messaging/features/test-send-modal';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';

export type AutomationEditorData = Readonly<{
  automation: AutomationDto;
  defaults: AutomationTexts;
  canManage: boolean;
  onSaved: (automation: AutomationDto) => void;
}>;

type TextField = 'subject' | 'body' | 'ctaLabel';
type Field = TextField | 'delayHours' | 'daysBefore' | 'cooldownDays';

const inRange = (value: unknown, [min, max]: readonly [number, number]) => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** Editar los textos y tiempos de una automatización, con vista previa, prueba y "Restaurar texto de Redom". */
@Component({
  selector: 'app-automation-editor-modal',
  imports: [ReactiveFormsModule, ModalCardComponent, SlotDirective, ButtonComponent, IconComponent, EmailPreviewComponent, TemplateVariablesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './automation-editor-modal.component.html',
})
export class AutomationEditorModalComponent {
  readonly dialogRef = inject<MatDialogRef<AutomationEditorModalComponent>>(MatDialogRef);
  readonly data = inject<AutomationEditorData>(MAT_DIALOG_DATA);
  readonly #service = inject(MessagingService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #fb = inject(FormBuilder);
  private readonly subjectRef = viewChild<ElementRef<HTMLInputElement>>('subjectInput');
  private readonly bodyRef = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');
  private readonly ctaRef = viewChild<ElementRef<HTMLInputElement>>('ctaInput');

  readonly subjectMax = SUBJECT_MAX;
  readonly bodyMax = AUTOMATION_BODY_MAX;
  readonly ctaMax = CTA_LABEL_MAX;
  readonly ranges = RANGES;

  readonly $automation = signal(this.data.automation);
  readonly info = AUTOMATION_INFO[this.data.automation.type];

  readonly form = this.#fb.nonNullable.group({
    subject: [''],
    body: [''],
    ctaLabel: [''],
    delayHours: [0],
    daysBefore: [0],
    cooldownDays: [0],
  });
  readonly $value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  readonly $lastText = signal<TextField>('body');
  readonly $saving = signal(false);
  readonly $submitted = signal(false);
  readonly $serverErrors = signal<Partial<Record<Field, string>>>({});
  readonly $invalidVariable = signal<string | null>(null);

  readonly $preview = signal<PreviewDto | null>(null);
  readonly $previewLoading = signal(false);
  readonly $previewError = signal<string | null>(null);

  readonly $dirty = computed(() => Object.keys(this.#changes()).length > 0);
  readonly $problems = computed(() => this.#problems());

  constructor() {
    this.#reset(this.data.automation);
    if (!this.data.canManage) this.form.disable();
    this.loadPreview();
  }

  show(field: Field): string | null {
    return this.$serverErrors()[field] ?? (this.$submitted() || this.form.controls[field].touched ? (this.$problems()[field] ?? null) : null);
  }

  focusText(field: TextField) {
    this.$lastText.set(field);
  }

  insertVariable(variable: TemplateVariable) {
    const field = this.$lastText();
    const element = field === 'subject' ? this.subjectRef() : field === 'ctaLabel' ? this.ctaRef() : this.bodyRef();
    insertAtCursor(element?.nativeElement ?? null, this.form.controls[field], `{{${variable}}}`);
    this.#clearServerError(field);
  }

  onInput(field: Field) {
    this.#clearServerError(field);
  }

  loadPreview() {
    this.$previewLoading.set(true);
    this.$previewError.set(null);
    this.#service.previewAutomation(this.data.automation.type).subscribe({
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

  async handleSave() {
    if (this.$saving() || !this.data.canManage) return;
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    const changes = this.#changes();
    if (!Object.keys(changes).length) {
      this.#toast.show('No hay cambios por guardar', 'warning');
      return;
    }
    await this.#save(changes, 'Cambios guardados');
  }

  handleTest() {
    if (this.$dirty()) this.#toast.show('La prueba usa lo guardado: guarda antes para probar tus cambios.', 'warning');
    openTestSendModal(this.#dialog, {
      title: this.info.title,
      send: (email) => this.#service.testAutomation(this.data.automation.type, email),
    });
  }

  handleRestore() {
    if (this.$saving()) return;
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Restaurar texto de Redom',
          message: 'Se reemplazan el asunto, el mensaje y el botón por los textos originales. Los tiempos y el estado no cambian.',
          confirmText: 'Restaurar',
          cancelText: 'Cancelar',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const { subject, body, ctaLabel } = this.data.defaults;
        void this.#save({ subject, body, ctaLabel }, 'Texto de Redom restaurado');
      });
  }

  handleClose() {
    if (!this.$dirty() || !this.data.canManage) {
      this.dialogRef.close();
      return;
    }
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Hay cambios sin guardar',
          message: 'Si cierras ahora, se pierden los cambios del correo.',
          confirmText: 'Descartar cambios',
          cancelText: 'Seguir editando',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => confirmed && this.dialogRef.close());
  }

  async #save(changes: UpdateAutomationDto, success: string) {
    this.$saving.set(true);
    try {
      const saved = await firstValueFrom(this.#service.updateAutomation(this.data.automation.type, changes));
      this.data.onSaved(saved);
      this.#reset(saved);
      this.#toast.show(success, 'success');
      this.loadPreview();
    } catch (error) {
      const { message, field, variable } = messagingError(error, 'No se pudieron guardar los cambios.');
      if (field && field in this.form.controls) this.$serverErrors.update((errors) => ({ ...errors, [field]: message ?? '' }));
      this.$invalidVariable.set(variable ?? null);
      if (message) this.#toast.show(message, 'error');
    } finally {
      this.$saving.set(false);
    }
  }

  #reset(automation: AutomationDto) {
    this.$automation.set(automation);
    this.form.reset({
      subject: automation.subject,
      body: automation.body,
      ctaLabel: automation.ctaLabel ?? '',
      delayHours: automation.delayHours,
      daysBefore: automation.daysBefore,
      cooldownDays: automation.cooldownDays,
    });
    this.$submitted.set(false);
    this.$serverErrors.set({});
    this.$invalidVariable.set(null);
  }

  #clearServerError(field: Field) {
    if (field === 'subject' || field === 'body' || field === 'ctaLabel') this.$invalidVariable.set(null);
    if (!this.$serverErrors()[field]) return;
    this.$serverErrors.update((errors) => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }

  #changes(): UpdateAutomationDto {
    const v = this.$value();
    const current = this.$automation();
    const changes: Record<string, unknown> = {};
    if (v.subject.trim() !== current.subject) changes['subject'] = v.subject.trim();
    if (v.body.trim() !== current.body) changes['body'] = v.body.trim();
    if ((v.ctaLabel.trim() || null) !== current.ctaLabel) changes['ctaLabel'] = v.ctaLabel.trim() || null;
    if (this.info.field === 'delayHours' && v.delayHours !== current.delayHours) changes['delayHours'] = v.delayHours;
    if (this.info.field === 'daysBefore' && v.daysBefore !== current.daysBefore) changes['daysBefore'] = v.daysBefore;
    if (v.cooldownDays !== current.cooldownDays) changes['cooldownDays'] = v.cooldownDays;
    return changes as UpdateAutomationDto;
  }

  #problems(): Partial<Record<Field, string>> {
    const v = this.$value();
    const problems: Partial<Record<Field, string>> = {};
    if (!v.subject.trim()) problems.subject = 'Escribe el asunto.';
    else if (v.subject.length > SUBJECT_MAX) problems.subject = `Hasta ${SUBJECT_MAX} caracteres.`;
    if (!v.body.trim()) problems.body = 'Escribe el mensaje.';
    else if (v.body.length > AUTOMATION_BODY_MAX) problems.body = `Hasta ${AUTOMATION_BODY_MAX} caracteres.`;
    if (v.ctaLabel.length > CTA_LABEL_MAX) problems.ctaLabel = `Hasta ${CTA_LABEL_MAX} caracteres.`;
    if (this.info.field === 'delayHours' && !inRange(v.delayHours, RANGES.delayHours))
      problems.delayHours = `Entre ${RANGES.delayHours[0]} y ${RANGES.delayHours[1]} horas.`;
    if (this.info.field === 'daysBefore' && !inRange(v.daysBefore, RANGES.daysBefore))
      problems.daysBefore = `Entre ${RANGES.daysBefore[0]} y ${RANGES.daysBefore[1]} días.`;
    if (!inRange(v.cooldownDays, RANGES.cooldownDays)) problems.cooldownDays = `Entre ${RANGES.cooldownDays[0]} y ${RANGES.cooldownDays[1]} días.`;
    return problems;
  }
}

export function openAutomationEditorModal(dialog: MatDialog, data: AutomationEditorData) {
  return dialog
    .open<AutomationEditorModalComponent, AutomationEditorData>(AutomationEditorModalComponent, {
      width: '1040px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
