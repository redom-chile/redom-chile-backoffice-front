import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FileUploadService, getUploadErrorMessage, ImageSelection } from 'src/app/core/services/file-upload';
import { FormBuilder } from '@angular/forms';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { UnitsService } from 'src/app/modules/inventory/data-access';
import { MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { GetAllCategoriesService } from '../../../categories/data-access';
import { sortCategoryTree } from 'src/app/modules/products/shared';
import { firstValueFrom } from 'rxjs';
import { CreateProductService, getProductSaveErrorMessage, UpdateProductService } from '../../data-access';
import {
  chefNoteToSend,
  createProductForm,
  varietiesError,
  injectEditableProductTags,
  injectPackContent,
  ProductFormFieldsComponent,
  ProductPackEditorComponent,
  ProductTagsFieldComponent,
  saveProductTagsIfChanged,
  toCreateProductDto,
} from '../../ui';
import { ProductModalResult } from '../product-modal-result';

@Component({
  selector: 'app-create-product-modal',
  standalone: true,
  imports: [ButtonComponent, ModalCardComponent, SlotDirective, ProductFormFieldsComponent, ProductTagsFieldComponent, ProductPackEditorComponent],
  templateUrl: './create-product-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateProductModalComponent implements OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<CreateProductModalComponent, ProductModalResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly createService = inject(CreateProductService);

  readonly #settings = inject(BusinessSettingsService);
  readonly #allCategories = inject(GetAllCategoriesService).$categories;
  // En el orden de la carta.
  readonly $categories = computed(() => sortCategoryTree(this.#allCategories() ?? [], this.#settings.$menuSortMode()));
  readonly #units = inject(UnitsService);
  readonly $inventoryEnabled = this.#settings.$inventoryEnabled;
  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;
  readonly $units = computed(() => this.#units.$units() ?? []);
  readonly form = createProductForm(inject(FormBuilder));
  readonly #updateService = inject(UpdateProductService);
  // Nota del chef: solo con menu_design en el plan.
  readonly #entitlements = inject(EntitlementsService);
  readonly #chefNoteEnabled = () => this.#entitlements.hasFeature('menu_design');
  #sentChefNote: string | null | undefined = undefined;
  readonly #upload = inject(FileUploadService);
  readonly $isUploading = this.#upload.$isUploading;
  readonly $uploadProgress = this.#upload.$progress;
  readonly #isSaving = signal(false);
  // Subiendo la imagen o guardando el producto.
  readonly $isLoading = computed(() => this.#isSaving() || !!this.createService.$isLoading());
  #image: ImageSelection = { kind: 'keep' };
  // Etiquetas de la carta: van por otro endpoint, después de crear el producto.
  readonly #menuSettings = inject(MenuSettingsService);
  readonly $tags = injectEditableProductTags();
  readonly $tagIds = signal<readonly number[]>([]);
  // Contenido del pack (type combo): va por otro endpoint, después de crear el producto.
  readonly pack = injectPackContent();
  readonly $isPack = toSignal(this.form.controls.isPack.valueChanges, { initialValue: this.form.controls.isPack.value });

  constructor() {
    if (this.$inventoryEnabled()) this.#units.load();
    this.pack.startEmpty();

    effect(() => {
      if (this.createService.$success()) {
        untracked(() => this.#afterCreate(this.createService.$createdId()));
      }
    });

    effect(() => {
      const status = this.createService.$error();
      if (status) {
        this.toast.show(getProductSaveErrorMessage(status, untracked(this.createService.$lastError)), 'error');
      }
    });
  }

  handleSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.show('Completa los campos obligatorios', 'warning');
      return;
    }
    const varietyError = varietiesError(this.form);
    if (varietyError) {
      this.form.markAllAsTouched();
      this.toast.show(varietyError, 'warning');
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

  // La imagen se sube recién al guardar; si falla, el producto no se crea.
  async #save() {
    this.#isSaving.set(true);
    try {
      const imageFileId = await this.#upload.resolveSelection(this.#image, 'products');
      const context = { inventoryEnabled: this.$inventoryEnabled(), chefNoteEnabled: this.#chefNoteEnabled() };
      this.#sentChefNote = chefNoteToSend(this.form, context);
      this.createService.create({ ...toCreateProductDto(this.form, context), ...(imageFileId ? { imageFileId } : {}) });
    } catch (error) {
      this.toast.show(getUploadErrorMessage(error), 'error');
    } finally {
      this.#isSaving.set(false);
    }
  }

  async #afterCreate(productId: number | null) {
    this.#isSaving.set(true);
    await this.#saveChefNote(productId);
    await saveProductTagsIfChanged(this.#menuSettings, this.toast, productId, this.$tagIds(), []);
    await this.pack.saveIfChanged(productId, !!this.form.controls.isPack.value, this.toast);
    this.#isSaving.set(false);
    this.dialogRef.close('created');
  }

  async #saveChefNote(productId: number | null) {
    if (!productId || !this.#sentChefNote) return;
    try {
      await firstValueFrom(this.#updateService.saveChefNote(productId, this.#sentChefNote));
    } catch (error) {
      const status = (error as { status?: number })?.status;
      this.toast.show(`Producto creado, pero no se guardó la nota del chef. ${getProductSaveErrorMessage(status, error as never)}`, 'warning');
    }
  }

  handleCancel() {
    this.dialogRef.close('cancelled');
  }

  ngOnDestroy(): void {
    this.createService.reset();
  }
}
