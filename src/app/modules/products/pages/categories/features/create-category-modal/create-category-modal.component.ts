import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { FileUploadService, getUploadErrorMessage, ImageSelection } from 'src/app/core/services/file-upload';
import { ButtonComponent, ImagePickerComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { CreateCategoryService, GetAllCategoriesService, getCategoryErrorMessage } from '../../data-access';
import { CategoryModalResult } from '../category-modal-result';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { CategoryIconPickerComponent, CategorySchedule, CategoryScheduleFieldComponent, isScheduleValid, saveCategoryScheduleIfChanged, toCategorySchedule } from '../../ui';
import { NgClass } from '@angular/common';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { sortForMenu } from 'src/app/modules/products/shared';

@Component({
  selector: 'app-create-category-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective, NgClass, ImagePickerComponent, CategoryScheduleFieldComponent, CategoryIconPickerComponent],
  templateUrl: './create-category-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateCategoryModalComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject<MatDialogRef<CreateCategoryModalComponent, CategoryModalResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly createService = inject(CreateCategoryService);
  private readonly getAllService = inject(GetAllCategoriesService);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    shortCode: ['', [Validators.maxLength(10)]],
    description: [''],
    parentId: [0],
  });

  // Solo las categorías principales pueden ser padre, en el orden de la carta.
  readonly #sortMode = inject(BusinessSettingsService).$menuSortMode;
  readonly $parentOptions = computed(() =>
    sortForMenu((this.getAllService.$categories() ?? []).filter((category) => !category.parentId), this.#sortMode()),
  );

  readonly #upload = inject(FileUploadService);
  readonly $isUploading = this.#upload.$isUploading;
  readonly $uploadProgress = this.#upload.$progress;
  readonly #isSaving = signal(false);
  readonly $isLoading = computed(() => this.#isSaving() || !!this.createService.$isLoading());
  #image: ImageSelection = { kind: 'keep' };
  readonly #access = inject(AccessService);
  // Horario en la carta: va por otro endpoint, después de guardar la categoría (mismo permiso que editarla).
  readonly #menuSettings = inject(MenuSettingsService);
  readonly $canEditSchedule = computed(() => this.#access.can(PERMISSIONS.CATEGORIES.UPDATE_CATEGORY));
  readonly $schedule = signal<CategorySchedule>(toCategorySchedule([]));
  readonly $scheduleSubmitted = signal(false);
  // Ícono en la carta (todos los planes): null = sin ícono.
  readonly $icon = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.createService.$success()) {
        untracked(() => this.#afterCreate(this.createService.$createdId()));
      }
    });

    effect(() => {
      const status = this.createService.$error();
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

  // La imagen se sube recién al guardar; si falla, la categoría no se crea.
  async #save() {
    this.#isSaving.set(true);
    try {
      const imageFileId = await this.#upload.resolveSelection(this.#image, 'categories');
      const value = this.form.getRawValue();
      this.createService.create({
        name: value.name!,
        shortCode: value.shortCode?.trim() || undefined,
        description: value.description || undefined,
        parentId: value.parentId || 0,
        ...(imageFileId ? { imageFileId } : {}),
        ...(this.$icon() ? { icon: this.$icon() } : {}),
      });
    } catch (error) {
      this.toast.show(getUploadErrorMessage(error), 'error');
    } finally {
      this.#isSaving.set(false);
    }
  }

  async #afterCreate(categoryId: number | null) {
    this.#isSaving.set(true);
    if (this.$canEditSchedule()) {
      await saveCategoryScheduleIfChanged(this.#menuSettings, this.toast, categoryId, this.$schedule(), toCategorySchedule([]));
    }
    this.#isSaving.set(false);
    this.dialogRef.close('created');
  }

  handleCancel() {
    this.dialogRef.close('cancelled');
  }

  ngOnDestroy(): void {
    this.createService.reset();
  }
}
