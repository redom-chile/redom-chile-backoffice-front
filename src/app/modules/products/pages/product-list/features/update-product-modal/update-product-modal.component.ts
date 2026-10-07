import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { FileUploadService, getUploadErrorMessage, ImageSelection } from 'src/app/core/services/file-upload';
import { FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { UnitsService } from 'src/app/modules/inventory/data-access';
import { GetAllCategoriesService } from '../../../categories/data-access';
import { ProductDto, UpdateProductService, getProductSaveErrorMessage } from '../../data-access';
import { createProductForm, ProductFormFieldsComponent, toUpdateProductDto } from '../../ui';
import { ProductModalResult } from '../product-modal-result';

@Component({
  selector: 'app-update-product-modal',
  standalone: true,
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ProductFormFieldsComponent],
  templateUrl: './update-product-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateProductModalComponent implements OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<UpdateProductModalComponent, ProductModalResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly updateService = inject(UpdateProductService);

  readonly $categories = inject(GetAllCategoriesService).$categories;
  readonly #settings = inject(BusinessSettingsService);
  readonly #units = inject(UnitsService);
  readonly $inventoryEnabled = this.#settings.$inventoryEnabled;
  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;
  readonly $units = computed(() => this.#units.$units() ?? []);
  readonly product = inject<ProductDto>(MAT_DIALOG_DATA);
  readonly form = createProductForm(inject(FormBuilder), this.product);
  readonly #upload = inject(FileUploadService);
  readonly $isUploading = this.#upload.$isUploading;
  readonly $uploadProgress = this.#upload.$progress;
  readonly #isSaving = signal(false);
  // Subiendo la imagen o guardando el producto.
  readonly $isLoading = computed(() => this.#isSaving() || !!this.updateService.$isLoading());
  #image: ImageSelection = { kind: 'keep' };
  readonly #router = inject(Router);
  // La receta se arma sobre lo guardado: solo si el producto ya es "Por receta".
  readonly $canConfigureRecipe = computed(() => this.product.stockMode === 'recipe' && this.$ingredientsEnabled());

  constructor() {
    if (this.$inventoryEnabled()) this.#units.load();

    effect(() => {
      if (this.updateService.$success()) {
        this.dialogRef.close('updated');
      }
    });

    effect(() => {
      const status = this.updateService.$error();
      if (status) {
        this.toast.show(getProductSaveErrorMessage(status, untracked(this.updateService.$lastError)), 'error');
      }
    });
  }

  handleSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.show('Completa los campos obligatorios', 'warning');
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
      const imageFileId = await this.#upload.resolveSelection(this.#image, 'products');
      this.updateService.update(this.product.id, {
        ...toUpdateProductDto(this.form, this.product, { inventoryEnabled: this.$inventoryEnabled() }),
        ...(imageFileId !== undefined ? { imageFileId } : {}),
      });
    } catch (error) {
      this.toast.show(getUploadErrorMessage(error), 'error');
    } finally {
      this.#isSaving.set(false);
    }
  }

  handleConfigureRecipe() {
    this.dialogRef.close('cancelled');
    this.#router.navigate(['/inventory/recipes', this.product.id]);
  }

  handleCancel() {
    this.dialogRef.close('cancelled');
  }

  ngOnDestroy(): void {
    this.updateService.reset();
  }
}
