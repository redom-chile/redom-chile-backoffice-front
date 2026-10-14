import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FileUploadService, getUploadErrorMessage, ImageSelection } from 'src/app/core/services/file-upload';
import { FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { UnitsService } from 'src/app/modules/inventory/data-access';
import { MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { GetAllCategoriesService } from '../../../categories/data-access';
import { ProductDto, UpdateProductService, getProductSaveErrorMessage } from '../../data-access';
import {
  createProductForm,
  injectEditableProductTags,
  injectPackContent,
  PACK_PRODUCT_TYPE,
  ProductFormFieldsComponent,
  ProductPackEditorComponent,
  ProductTagsFieldComponent,
  saveProductTagsIfChanged,
  toUpdateProductDto,
} from '../../ui';
import { ProductModalResult } from '../product-modal-result';

@Component({
  selector: 'app-update-product-modal',
  standalone: true,
  imports: [
    ButtonComponent,
    IconComponent,
    ModalCardComponent,
    SlotDirective,
    ProductFormFieldsComponent,
    ProductTagsFieldComponent,
    ProductPackEditorComponent,
  ],
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
  // Etiquetas de la carta: van por otro endpoint, después de guardar el producto y solo si cambiaron.
  // GET /products aún no las devuelve: si no vienen, se parte vacío y se avisa que se reemplazan.
  readonly #menuSettings = inject(MenuSettingsService);
  readonly $tags = injectEditableProductTags();
  readonly #initialTagIds: readonly number[] = this.product.tags?.map((tag) => tag.id) ?? [];
  readonly $tagIds = signal<readonly number[]>(this.#initialTagIds);
  readonly tagsNote = this.product.tags
    ? null
    : 'Las etiquetas que ya tiene el producto aún no se muestran aquí: si eliges otras, reemplazan a las anteriores.';
  // Contenido del pack (type combo): se carga si ya es pack y se guarda después del producto, solo si cambió.
  readonly pack = injectPackContent();
  readonly $isPack = toSignal(this.form.controls.isPack.valueChanges, { initialValue: this.form.controls.isPack.value });
  readonly #router = inject(Router);
  // La receta se arma sobre lo guardado: solo si el producto ya es "Por receta".
  readonly $canConfigureRecipe = computed(() => this.product.stockMode === 'recipe' && this.$ingredientsEnabled());

  constructor() {
    if (this.$inventoryEnabled()) this.#units.load();
    // Si ya es pack se carga lo guardado; si recién pasa a serlo, parte vacío.
    if (this.product.type === PACK_PRODUCT_TYPE) this.pack.load(this.product.id);
    else this.pack.startEmpty();

    effect(() => {
      if (this.updateService.$success()) {
        untracked(() => this.#afterUpdate());
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
    const packError = this.pack.validate(!!this.form.controls.isPack.value);
    if (packError) {
      this.toast.show(packError, 'warning');
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

  async #afterUpdate() {
    this.#isSaving.set(true);
    await saveProductTagsIfChanged(this.#menuSettings, this.toast, this.product.id, this.$tagIds(), this.#initialTagIds);
    await this.pack.saveIfChanged(this.product.id, !!this.form.controls.isPack.value, this.toast);
    this.#isSaving.set(false);
    this.dialogRef.close('updated');
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
