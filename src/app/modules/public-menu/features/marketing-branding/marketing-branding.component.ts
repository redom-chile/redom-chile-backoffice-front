import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { FileUploadService, getUploadErrorMessage, ImageSelection, ImageUploadError } from 'src/app/core/services/file-upload';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { BrandingDto, getPublicMenuErrorMessage, MenuMarketingService, UpdateBrandingDto } from 'src/app/modules/public-menu/data-access';
import { isFeatureNotIncluded, marketingSaveError, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, IconComponent, ImagePickerComponent, SkeletonComponent, ToastService } from 'src/ui';
import { contrastRatio, DEFAULT_THEME, HEX_COLOR, MIN_CONTRAST, readableOn, THEME_KEYS, THEME_LABELS, ThemeKey } from './branding-colors';

type ThemeForm = Record<ThemeKey, string>;

const fromBranding = (branding: BrandingDto | null): ThemeForm => ({
  primaryColor: branding?.theme.primaryColor?.toUpperCase() ?? '',
  backgroundColor: branding?.theme.backgroundColor?.toUpperCase() ?? '',
  textColor: branding?.theme.textColor?.toUpperCase() ?? '',
});

/** Pestaña Personalización: colores y portada de la carta de un local (plan menu_branding). */
@Component({
  selector: 'app-marketing-branding',
  imports: [ButtonComponent, IconComponent, SkeletonComponent, ImagePickerComponent, CheckPermissionDirective, MarketingUpsellCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marketing-branding.component.html',
})
export class MarketingBrandingComponent {
  readonly #service = inject(MenuMarketingService);
  readonly #upload = inject(FileUploadService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly locationId = input.required<number>();
  readonly locationName = input('');

  readonly PERMISSIONS = PERMISSIONS;
  readonly keys = THEME_KEYS;
  readonly labels = THEME_LABELS;
  readonly defaults = DEFAULT_THEME;
  readonly minContrast = MIN_CONTRAST;
  readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));
  readonly $uploading = this.#upload.$isUploading;
  readonly $progress = this.#upload.$progress;

  readonly branding = rxResource({
    params: () => this.locationId(),
    stream: ({ params }) => this.#service.getBranding(params).pipe(toRemoteResult()),
  });
  readonly $saved = linkedSignal(() => resultValue(this.branding.value()));
  readonly $error = computed(() => resultError(this.branding.value()));
  readonly $blocked = computed(() => isFeatureNotIncluded(this.$error()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.$error()));
  readonly $errorMessage = computed(() => getPublicMenuErrorMessage(this.$error(), 'No se pudo cargar la personalización.'));

  // '' = color por defecto.
  readonly $theme = linkedSignal<ThemeForm>(() => fromBranding(this.$saved()));
  readonly $cover = signal<ImageSelection>({ kind: 'keep' });
  // Cambia para reiniciar el selector de portada tras guardar o cambiar de local.
  readonly $pickerKey = signal(0);
  readonly #coverPreview = signal<string | null>(null);
  readonly $isSaving = signal(false);

  readonly $effective = computed<ThemeForm>(() => {
    const theme = this.$theme();
    const pick = (key: ThemeKey) => (HEX_COLOR.test(theme[key]) ? theme[key] : DEFAULT_THEME[key]);
    return { primaryColor: pick('primaryColor'), backgroundColor: pick('backgroundColor'), textColor: pick('textColor') };
  });
  readonly $contrast = computed(() => contrastRatio(this.$effective().textColor, this.$effective().backgroundColor));
  readonly $contrastLabel = computed(() => this.$contrast().toFixed(1).replace('.', ','));
  readonly $onPrimary = computed(() => readableOn(this.$effective().primaryColor));
  readonly $invalidKeys = computed(() => THEME_KEYS.filter((key) => this.$theme()[key] && !HEX_COLOR.test(this.$theme()[key])));
  readonly $coverUrl = computed(() => {
    const cover = this.$cover();
    if (cover.kind === 'set') return this.#coverPreview();
    if (cover.kind === 'remove') return null;
    return this.$saved()?.coverUrl ?? null;
  });
  readonly $changes = computed(() => this.#changes());
  readonly $dirty = computed(() => Object.keys(this.$changes()).length > 0 || this.$cover().kind !== 'keep');

  constructor() {
    // Otro local: se descarta la portada elegida.
    effect(() => {
      this.locationId();
      untracked(() => this.#resetCover());
    });
    inject(DestroyRef).onDestroy(() => this.#revokePreview());
  }

  setColor(key: ThemeKey, value: string) {
    let hex = value.trim().toUpperCase();
    if (hex && !hex.startsWith('#')) hex = `#${hex}`;
    this.$theme.update((theme) => ({ ...theme, [key]: hex }));
  }

  reset(key: ThemeKey) {
    this.$theme.update((theme) => ({ ...theme, [key]: '' }));
  }

  onCover(selection: ImageSelection) {
    this.#revokePreview();
    if (selection.kind === 'set') this.#coverPreview.set(URL.createObjectURL(selection.file));
    this.$cover.set(selection);
  }

  discard() {
    this.$theme.set(fromBranding(this.$saved()));
    this.#resetCover();
  }

  async save() {
    if (this.$isSaving() || !this.$dirty()) return;
    if (this.$invalidKeys().length) {
      this.#toast.show('Usa colores en formato #RRGGBB', 'warning');
      return;
    }
    const locationId = this.locationId();
    this.$isSaving.set(true);
    try {
      const coverFileId = await this.#upload.resolveSelection(this.$cover(), 'menu_covers');
      const dto: UpdateBrandingDto = { ...this.$changes(), ...(coverFileId !== undefined ? { coverFileId } : {}) };
      const saved = await firstValueFrom(this.#service.updateBranding(locationId, dto));
      this.$saved.set(saved);
      this.#resetCover();
      this.#toast.show('Personalización guardada', 'success');
    } catch (error) {
      const message = error instanceof ImageUploadError ? getUploadErrorMessage(error) : marketingSaveError(error, 'No se pudo guardar la personalización.');
      if (message) this.#toast.show(message, 'error');
    } finally {
      this.$isSaving.set(false);
    }
  }

  /** Solo los colores que cambiaron (null vuelve al por defecto). */
  #changes(): UpdateBrandingDto {
    const saved = fromBranding(this.$saved());
    const theme = this.$theme();
    const changed: Partial<Record<ThemeKey, string | null>> = {};
    for (const key of THEME_KEYS) if (theme[key] !== saved[key]) changed[key] = theme[key] || null;
    return Object.keys(changed).length ? { theme: changed } : {};
  }

  #resetCover() {
    this.#revokePreview();
    this.$cover.set({ kind: 'keep' });
    this.$pickerKey.update((key) => key + 1);
  }

  #revokePreview() {
    const url = this.#coverPreview();
    if (url) URL.revokeObjectURL(url);
    this.#coverPreview.set(null);
  }
}
