import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FileUploadService, getUploadErrorMessage, ImageSelection } from 'src/app/core/services/file-upload';
import { FormBuilder } from '@angular/forms';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { RecipesService, UnitsService } from 'src/app/modules/inventory/data-access';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { GetAllCategoriesService } from '../../../categories/data-access';
import { sortCategoryTree } from 'src/app/modules/products/shared';
import { ProductDto, UpdateProductService, getProductSaveErrorMessage } from '../../data-access';
import {
  createProductForm,
  varietiesError,
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

  readonly #settings = inject(BusinessSettingsService);
  readonly #allCategories = inject(GetAllCategoriesService).$categories;
  // En el orden de la carta.
  readonly $categories = computed(() => sortCategoryTree(this.#allCategories() ?? [], this.#settings.$menuSortMode()));
  readonly #units = inject(UnitsService);
  readonly $inventoryEnabled = this.#settings.$inventoryEnabled;
  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;
  readonly $units = computed(() => this.#units.$units() ?? []);
  readonly product = inject<ProductDto>(MAT_DIALOG_DATA);
  readonly form = createProductForm(inject(FormBuilder), this.product);
  // Nota del chef: solo con menu_design en el plan.
  readonly #entitlements = inject(EntitlementsService);
  readonly #chefNoteEnabled = () => this.#entitlements.hasFeature('menu_design');
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
  // Variedades guardadas sin receta (null mientras no se sepa o si no aplica).
  readonly $missingRecipeIds = signal<ReadonlySet<number> | null>(null);
  readonly #recipes = inject(RecipesService);
  readonly #access = inject(AccessService);
  readonly #destroyRef = inject(DestroyRef);

  constructor() {
    if (this.$inventoryEnabled()) this.#units.load();
    this.#loadMissingRecipes();
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

  // Sin tocar la imagen no se envía el campo; quitarla envía null.
  async #save() {
    this.#isSaving.set(true);
    try {
      const imageFileId = await this.#upload.resolveSelection(this.#image, 'products');
      const context = { inventoryEnabled: this.$inventoryEnabled(), chefNoteEnabled: this.#chefNoteEnabled() };
      this.updateService.update(this.product.id, {
        ...toUpdateProductDto(this.form, this.product, context),
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

  #loadMissingRecipes() {
    const applies =
      this.product.stockMode === 'recipe' &&
      this.$inventoryEnabled() &&
      this.$ingredientsEnabled() &&
      this.#access.can(PERMISSIONS.RECIPES.GET_ALL_RECIPES);
    if (!applies) return;
    // Si falla queda la ayuda genérica.
    this.#recipes
      .getByProduct(this.product.id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (data) =>
          this.$missingRecipeIds.set(new Set(data.variations.filter((variation) => !variation.items.length).map((v) => v.variationId))),
        error: () => this.$missingRecipeIds.set(null),
      });
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
