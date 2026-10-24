import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FileUploadService, getUploadErrorMessage, ImageSelection } from 'src/app/core/services/file-upload';
import { ButtonComponent, ImagePickerComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { checkCategoryIconSaved, UpdateCategoryService, CategoryDto, getCategoryErrorMessage } from '../../data-access';
import { CategoryModalResult } from '../category-modal-result';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { CategoryIconPickerComponent, CategorySchedule, CategoryScheduleFieldComponent, isScheduleValid, saveCategoryScheduleIfChanged, toCategorySchedule } from '../../ui';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-update-category-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective, NgClass, ImagePickerComponent, CategoryScheduleFieldComponent, CategoryIconPickerComponent],
  templateUrl: './update-category-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateCategoryModalComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject<MatDialogRef<UpdateCategoryModalComponent, CategoryModalResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly updateService = inject(UpdateCategoryService);
  readonly category = inject<CategoryDto>(MAT_DIALOG_DATA);

  readonly form = this.fb.group({
    name: [this.category.name, [Validators.required, Validators.minLength(2)]],
    shortCode: [this.category.shortCode || '', [Validators.maxLength(10)]],
    description: [this.category.description || ''],
  });

  readonly #upload = inject(FileUploadService);
  readonly $isUploading = this.#upload.$isUploading;
  readonly $uploadProgress = this.#upload.$progress;
  readonly #isSaving = signal(false);
  readonly $isLoading = computed(() => this.#isSaving() || !!this.updateService.$isLoading());
  #image: ImageSelection = { kind: 'keep' };
  readonly #access = inject(AccessService);
  // Horario en la carta: va por otro endpoint, después de guardar la categoría (mismo permiso que editarla).
  readonly #menuSettings = inject(MenuSettingsService);
  readonly $canEditSchedule = computed(() => this.#access.can(PERMISSIONS.CATEGORIES.UPDATE_CATEGORY));
  // GET /categories aún no devuelve el horario: sin él no se conoce el actual y solo se envía si el usuario lo toca.
  readonly #initialSchedule: CategorySchedule | null = this.category.schedule ? toCategorySchedule(this.category.schedule) : null;
  readonly $schedule = signal<CategorySchedule>(this.#initialSchedule ?? toCategorySchedule([]));
  readonly $scheduleSubmitted = signal(false);
  // Ícono en la carta (etapa 8): solo se envía si cambia.
  readonly #initialIcon = this.category.icon ?? null;
  readonly $icon = signal<string | null>(this.#initialIcon);
  readonly #http = inject(HttpClient);
  // Íconos de la carta: plan con menu_design (el backend responde 403 sin la función).
  readonly #entitlements = inject(EntitlementsService);
  readonly $canUseIcons = computed(() => this.#entitlements.hasFeature('menu_design'));
  readonly #iconChanged = () => this.$canUseIcons() && this.$icon() !== this.#initialIcon;
  readonly scheduleNote = this.category.schedule
    ? null
    : 'El horario actual de la categoría aún no se muestra aquí: si lo cambias, reemplaza al anterior.';

  constructor() {
    effect(() => {
      if (this.updateService.$success()) {
        untracked(() => this.#afterUpdate());
      }
    });

    effect(() => {
      const status = this.updateService.$error();
      if (status) {
        this.toast.show(getCategoryErrorMessage(status), 'error');
      }
    });
  }

  handleSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.show('Completa los campos obligatorios', 'warning');
      return;
    }
    if (this.$canEditSchedule() && !isScheduleValid(this.$schedule())) {
      this.$scheduleSubmitted.set(true);
      this.toast.show('Revisa el horario en la carta', 'warning');
      return;
    }
    this.#save();
  }

  onImageChange(selection: ImageSelection) {
    this.#image = selection;
  }

  // Sin tocar la imagen no se envía el campo; quitarla envía null.
  async #save() {
    this.#isSaving.set(true);
    try {
      const imageFileId = await this.#upload.resolveSelection(this.#image, 'categories');
      const value = this.form.getRawValue();
      this.updateService.update({
        id: this.category.id,
        name: value.name || undefined,
        shortCode: value.shortCode?.trim() || undefined,
        description: value.description || undefined,
        ...(imageFileId !== undefined ? { imageFileId } : {}),
        ...(this.#iconChanged() ? { icon: this.$icon() } : {}),
      });
    } catch (error) {
      this.toast.show(getUploadErrorMessage(error), 'error');
    } finally {
      this.#isSaving.set(false);
    }
  }

  async #afterUpdate() {
    this.#isSaving.set(true);
    if (this.#iconChanged()) await checkCategoryIconSaved(this.#http, this.category.id, this.$icon());
    if (this.$canEditSchedule()) {
      await saveCategoryScheduleIfChanged(this.#menuSettings, this.toast, this.category.id, this.$schedule(), this.#initialSchedule);
    }
    this.#isSaving.set(false);
    this.dialogRef.close('updated');
  }

  handleCancel() {
    this.dialogRef.close('cancelled');
  }

  ngOnDestroy(): void {
    this.updateService.reset();
  }
}
