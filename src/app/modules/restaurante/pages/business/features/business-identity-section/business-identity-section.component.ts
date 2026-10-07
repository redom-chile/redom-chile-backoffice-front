import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { THEME_COLORS, ThemeColorName } from 'src/app/core/constants/theme-colors';
import { BrandColorService } from 'src/app/core/services/brand-color';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { getUploadErrorMessage, FileUploadService, ImageSelection } from 'src/app/core/services/file-upload';
import { ThemeService } from 'src/app/core/services/theme.service';
import { ButtonComponent, CardComponent, IconComponent, ImagePickerComponent, ToastService } from 'src/ui';
import { BusinessDto, FindMyBusinessesService, getBusinessErrorMessage, UpdateBusinessLogoService } from '../../data-access';

const NAME_MAX_LENGTH = 191;

/** Sección "Identidad": nombre, logo y color de marca. */
@Component({
  selector: 'app-business-identity-section',
  imports: [CardComponent, ButtonComponent, IconComponent, ImagePickerComponent],
  templateUrl: './business-identity-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessIdentitySectionComponent {
  readonly #settings = inject(BusinessSettingsService);
  readonly #businesses = inject(FindMyBusinessesService);
  readonly #toast = inject(ToastService);

  readonly $business = input.required<BusinessDto>({ alias: 'business' });

  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  readonly #savedName = computed(() => this.#settings.$settings()?.name ?? this.$business().name);
  protected readonly $name = linkedSignal(() => this.#savedName());
  protected readonly $nameError = computed(() => {
    const name = this.$name().trim();
    if (!name) return 'El nombre es obligatorio.';
    if (name.length > NAME_MAX_LENGTH) return `Máximo ${NAME_MAX_LENGTH} caracteres.`;
    return null;
  });
  protected readonly $nameChanged = computed(() => this.$name().trim() !== this.#savedName());
  protected readonly $isSavingName = signal(false);

  onNameInput(event: Event) {
    this.$name.set((event.target as HTMLInputElement).value);
  }

  saveName() {
    if (!this.$nameChanged() || this.$nameError() || this.$isSavingName()) return;
    const name = this.$name().trim();
    this.$isSavingName.set(true);
    this.#settings.update({ name }).subscribe({
      next: () => {
        this.$isSavingName.set(false);
        this.$name.set(name);
        this.#toast.show('Nombre actualizado', 'success');
        // El nombre también se muestra desde "mis negocios".
        this.#businesses.retry();
      },
      error: (error) => {
        this.$isSavingName.set(false);
        this.#toast.show(getBusinessErrorMessage(error), 'error');
      },
    });
  }

  discardName() {
    this.$name.set(this.#savedName());
  }

  // Logo: se sube a business_logos y se guarda con su propio botón.
  readonly #upload = inject(FileUploadService);
  readonly #logoService = inject(UpdateBusinessLogoService);
  protected readonly $isUploading = this.#upload.$isUploading;
  protected readonly $uploadProgress = this.#upload.$progress;
  protected readonly $logoSelection = signal<ImageSelection>({ kind: 'keep' });
  protected readonly $isSavingLogo = signal(false);
  // Remonta el selector para descartar la vista previa tras guardar.
  protected readonly $pickerKey = signal(0);

  async saveLogo() {
    const selection = this.$logoSelection();
    if (selection.kind === 'keep') return;
    this.$isSavingLogo.set(true);
    try {
      const logoFileId = (await this.#upload.resolveSelection(selection, 'business_logos')) ?? null;
      await firstValueFrom(this.#logoService.update(this.$business().id, logoFileId));
      this.#toast.show(logoFileId ? 'Logo actualizado' : 'Logo eliminado', 'success');
      this.discardLogo();
      this.#businesses.retry();
    } catch (error) {
      this.#toast.show(getUploadErrorMessage(error), 'error');
    } finally {
      this.$isSavingLogo.set(false);
    }
  }

  discardLogo() {
    this.$logoSelection.set({ kind: 'keep' });
    this.$pickerKey.update((key) => key + 1);
  }

  // Color de marca: se guarda al elegirlo y lo ven todos los usuarios del restaurante.
  readonly #brandColor = inject(BrandColorService);
  readonly #themeService = inject(ThemeService);
  protected readonly themeColors = THEME_COLORS;
  protected readonly $currentColor = computed(() => this.#themeService.theme().color);
  protected readonly $savingColor = signal<ThemeColorName | null>(null);

  selectColor(color: ThemeColorName) {
    if (color === this.$currentColor() || this.$savingColor()) return;
    this.$savingColor.set(color);
    this.#brandColor.save(this.$business().id, color).subscribe({
      next: () => {
        this.$savingColor.set(null);
        this.#toast.show('Color del restaurante actualizado', 'success');
      },
      error: () => {
        this.$savingColor.set(null);
        this.#toast.show('No se pudo guardar el color. Inténtalo de nuevo.', 'error');
      },
    });
  }
}
