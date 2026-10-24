import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map, Observable, of } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { FileUploadService, getUploadErrorMessage, ImageSelection, ImageUploadError } from 'src/app/core/services/file-upload';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  chefPicksError,
  ChefPicksDto,
  DEFAULT_MENU_DESIGN,
  getPublicMenuErrorMessage,
  MenuDesignService,
  MenuDesignVersionDto,
  menuDesignErrorField,
  menuDesignFieldMessage,
  MenuMarketingService,
  MenuSettingsService,
  PublicLocationMenuDto,
  PublicMenuApiService,
} from 'src/app/modules/public-menu/data-access';
import { TabDirective, TabListDirective } from 'src/app/modules/public-menu/features/a11y-tabs';
import { isFeatureNotIncluded, marketingSaveError } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { MenuDesignChefComponent, ChefProductOption } from 'src/app/modules/public-menu/features/menu-design-chef';
import { DesignCategoryOption, MenuDesignEditorComponent } from 'src/app/modules/public-menu/features/menu-design-editor';
import { MenuDesignHistoryComponent } from 'src/app/modules/public-menu/features/menu-design-history';
import { MenuDesignPreviewComponent } from 'src/app/modules/public-menu/features/menu-design-preview';
import {
  ChefDraft,
  chefFromDto,
  chefProblem,
  chefToDto,
  DEFAULT_CHEF_TITLE,
  designChanges,
  DesignDraft,
  designFromDto,
  designProblem,
  EMPTY_CHEF_PICKS,
  isStageMissing,
  publicDesign,
  sameChef,
  STORY_MAX,
} from 'src/app/modules/public-menu/features/menu-design-shared';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';

type Tab = 'design' | 'chef' | 'history';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: string }> = [
  { id: 'design', label: 'Diseño', icon: 'palette' },
  { id: 'chef', label: 'Recomendaciones del chef', icon: 'restaurant_menu' },
  { id: 'history', label: 'Historial', icon: 'history' },
];

const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

/**
 * Configuración → Carta online → Diseño: plantilla, tipografía, tarjetas, anuncio, historia, accesibilidad y
 * recomendaciones del chef de cada local, con vista previa en vivo. Query params: locationId, tab (design|chef|history).
 */
@Component({
  selector: 'app-menu-design',
  imports: [
    RouterLink,
    TabDirective,
    TabListDirective,
    HeaderDashboardComponent,
    IconComponent,
    ButtonComponent,
    SkeletonComponent,
    CheckPermissionDirective,
    MarketingUpsellCardComponent,
    MenuDesignEditorComponent,
    MenuDesignChefComponent,
    MenuDesignHistoryComponent,
    MenuDesignPreviewComponent,
  ],
  templateUrl: './menu-design.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)', '(document:keydown.escape)': '$previewOpen.set(false)' },
})
export class MenuDesignComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #business = inject(BusinessSettingsService);
  readonly #settingsService = inject(MenuSettingsService);
  readonly #designService = inject(MenuDesignService);
  readonly #marketing = inject(MenuMarketingService);
  readonly #publicApi = inject(PublicMenuApiService);
  readonly #upload = inject(FileUploadService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly tabs = TABS;
  readonly storyMax = STORY_MAX;

  readonly $hasDesign = computed(() => this.#entitlements.hasFeature('menu_design'));
  readonly $hasBranding = computed(() => this.#entitlements.hasFeature('menu_branding'));
  readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));
  readonly $timeZone = computed(() => this.#business.$settings()?.timeZone ?? null);
  readonly $uploading = this.#upload.$isUploading;
  readonly $progress = this.#upload.$progress;

  readonly #params = toSignal(this.#route.queryParamMap.pipe(map((params) => ({ tab: params.get('tab'), locationId: Number(params.get('locationId')) || null }))), {
    initialValue: { tab: null, locationId: null },
  });
  readonly $tab = computed<Tab>(() => {
    const tab = this.#params().tab;
    return isTab(tab) ? tab : 'design';
  });

  // --- Locales ---
  readonly settings = rxResource({ stream: () => this.#settingsService.getSettings().pipe(toRemoteResult()) });
  readonly $locations = computed(() => resultValue(this.settings.value()) ?? []);
  readonly $settingsError = computed(() => {
    const error = resultError(this.settings.value());
    return error ? getPublicMenuErrorMessage(error, 'No se pudieron cargar los locales.') : null;
  });
  readonly $isLoadingLocations = computed(() => this.settings.isLoading() && !this.$locations().length);
  readonly $locationId = computed(() => {
    const id = this.#params().locationId;
    const list = this.$locations();
    return list.some((item) => item.locationId === id) ? id : (list[0]?.locationId ?? null);
  });
  readonly $location = computed(() => this.$locations().find((item) => item.locationId === this.$locationId()) ?? null);

  // --- Carta pública (base de la vista previa) ---
  readonly publicMenu = rxResource({
    params: () => {
      const location = this.$location();
      return location?.businessSlug && location.locationSlug ? { business: location.businessSlug, location: location.locationSlug, id: location.locationId } : undefined;
    },
    stream: ({ params }) => this.#publicApi.getLocationMenu(params.business, params.location).pipe(toRemoteResult()),
  });
  readonly $menu = computed(() => resultValue(this.publicMenu.value()));
  readonly $menuNote = computed(() => {
    const location = this.$location();
    if (!location) return null;
    if (!location.businessSlug || !location.locationSlug) return 'Configura la dirección pública del local en Carta pública para ver la vista previa con tus productos.';
    const error = resultError(this.publicMenu.value());
    if (!error) return null;
    return !location.isPublished ? 'Publica la carta de este local para ver la vista previa con tus productos.' : getPublicMenuErrorMessage(error, 'No se pudo cargar la carta del local.');
  });

  // --- Diseño ---
  readonly design = rxResource({
    params: () => this.$locationId() ?? undefined,
    stream: ({ params }) => this.#designService.getDesign(params).pipe(toRemoteResult()),
  });
  readonly #designError = computed(() => resultError(this.design.value()));
  readonly $designMissing = computed(() => isStageMissing(this.#designError()));
  readonly $designError = computed(() => {
    const error = this.#designError();
    if (!error || this.$designMissing() || isFeatureNotIncluded(error)) return null;
    return getPublicMenuErrorMessage(error, 'No se pudo cargar el diseño de la carta.');
  });
  // Sin la etapa en el servidor (o sin plan) se parte del diseño por defecto.
  readonly $savedDesign = linkedSignal(() => {
    const result = this.design.value();
    if (!result) return null;
    if (result.ok) return designFromDto(result.value, this.$timeZone());
    return this.$designError() ? null : designFromDto(null);
  });
  readonly $draftDesign = linkedSignal(() => this.$savedDesign());
  /** Campo que rechazó el backend (details.field de MENU_DESIGN_INVALID); se limpia al editar. */
  readonly $designFieldError = signal<Readonly<{ field: string; message: string }> | null>(null);
  readonly $designDirty = computed(() => {
    const saved = this.$savedDesign();
    const draft = this.$draftDesign();
    return !!saved && !!draft && Object.keys(designChanges(saved, draft, this.$timeZone())).length > 0;
  });

  // --- Nuestra historia (branding) ---
  readonly branding = rxResource({
    params: () => (this.$hasBranding() ? (this.$locationId() ?? undefined) : undefined),
    stream: ({ params }) => this.#marketing.getBranding(params).pipe(toRemoteResult()),
  });
  readonly $storyReady = computed(() => !!resultValue(this.branding.value()));
  readonly $savedStory = linkedSignal(() => resultValue(this.branding.value())?.story ?? '');
  readonly $draftStory = linkedSignal(() => this.$savedStory());
  readonly $storyDirty = computed(() => this.$hasBranding() && this.$storyReady() && this.$draftStory().trim() !== this.$savedStory().trim());

  // --- Recomendaciones del chef ---
  readonly chef = rxResource({
    params: () => (this.$hasDesign() ? (this.$locationId() ?? undefined) : undefined),
    stream: ({ params }) => this.#designService.getChefPicks(params).pipe(toRemoteResult()),
  });
  readonly #chefError = computed(() => resultError(this.chef.value()));
  readonly $chefMissing = computed(() => isStageMissing(this.#chefError()));
  readonly $chefError = computed(() => {
    const error = this.#chefError();
    if (!error || this.$chefMissing() || isFeatureNotIncluded(error)) return null;
    return getPublicMenuErrorMessage(error, 'No se pudieron cargar las recomendaciones del chef.');
  });
  readonly $savedChefDto = linkedSignal<ChefPicksDto | null>(() => {
    const result = this.chef.value();
    if (!result) return null;
    if (result.ok) return result.value;
    return this.$chefError() ? null : EMPTY_CHEF_PICKS;
  });
  readonly $savedChef = computed(() => {
    const dto = this.$savedChefDto();
    return dto ? chefFromDto(dto) : null;
  });
  readonly $draftChef = linkedSignal(() => this.$savedChef());
  readonly $chefPhoto = signal<ImageSelection>({ kind: 'keep' });
  readonly #chefPhotoPreview = signal<string | null>(null);
  readonly $chefPickerKey = signal(0);
  readonly $chefPhotoUrl = computed(() => {
    const photo = this.$chefPhoto();
    if (photo.kind === 'set') return this.#chefPhotoPreview();
    if (photo.kind === 'remove') return null;
    return this.$savedChefDto()?.photoUrl ?? null;
  });
  /** Rechazo del backend (CHEF_PICKS_INVALID): motivo y productos a marcar; se limpia al editar. */
  readonly $chefInvalid = signal<Readonly<{ reason: string | null; productIds: readonly number[] }> | null>(null);
  readonly $chefDirty = computed(() => {
    const saved = this.$savedChef();
    const draft = this.$draftChef();
    return !!saved && !!draft && (!sameChef(saved, draft) || this.$chefPhoto().kind !== 'keep');
  });

  // --- Historial ---
  readonly versions = rxResource({
    params: () => (this.$tab() === 'history' && this.$hasDesign() ? (this.$locationId() ?? undefined) : undefined),
    stream: ({ params }) => this.#designService.getVersions(params).pipe(toRemoteResult()),
  });
  readonly $versionsMissing = computed(() => isStageMissing(resultError(this.versions.value())));
  readonly $versions = computed(() => resultValue(this.versions.value()) ?? []);
  readonly $versionsError = computed(() => {
    const error = resultError(this.versions.value());
    if (!error || this.$versionsMissing()) return null;
    return getPublicMenuErrorMessage(error, 'No se pudo cargar el historial.');
  });
  /** Versión que se mira en la vista previa (solo en Historial). */
  readonly $viewVersion = signal<MenuDesignVersionDto | null>(null);
  readonly $restoringId = signal<number | null>(null);

  readonly $stageMissing = computed(() => this.$designMissing() || this.$chefMissing() || this.$versionsMissing());
  readonly $isSaving = signal(false);
  readonly $previewOpen = signal(false);
  readonly $designLocked = computed(() => !this.$canEdit() || this.$isSaving());

  // --- Datos de la carta para los editores ---
  readonly $categories = computed<DesignCategoryOption[]>(() =>
    (this.$menu()?.categories ?? []).flatMap((category) => [
      { id: String(category.id), name: category.name, depth: 0 as const },
      ...category.subcategories.map((sub) => ({ id: String(sub.id), name: sub.name, depth: 1 as const })),
    ]),
  );
  readonly $catalog = computed<ChefProductOption[]>(() => {
    const menu = this.$menu();
    if (!menu) return [];
    const seen = new Map<number, ChefProductOption>();
    const add = (products: PublicLocationMenuDto['uncategorized'], category: string) => {
      for (const p of products) if (!seen.has(p.id)) seen.set(p.id, { id: p.id, name: p.name, imageUrl: p.imageUrl, soldOut: p.soldOut, category });
    };
    for (const category of menu.categories) {
      add(category.products, category.name);
      for (const sub of category.subcategories) add(sub.products, `${category.name} · ${sub.name}`);
    }
    add(menu.uncategorized, 'Sin categoría');
    return [...seen.values()];
  });

  /**
   * La carta real con lo que se está editando (sin plan, como la verá el cliente: clásica con su accesibilidad).
   * Al mirar una versión se aplican su diseño, sus colores y su historia (la portada sigue siendo la actual).
   */
  readonly $previewMenu = computed<PublicLocationMenuDto | null>(() => {
    const menu = this.$menu();
    if (!menu) return null;
    const version = this.$tab() === 'history' ? this.$viewVersion() : null;
    const draft = version ? designFromDto(version.design, this.$timeZone()) : (this.$draftDesign() ?? designFromDto(null));
    const full = this.$hasDesign();
    const text = draft.announcement.text.trim();
    const chef = this.$draftChef();
    const branded = this.$hasBranding();
    const draftStory = version ? (version.branding.story ?? '') : this.$draftStory();
    const story = branded ? draftStory.trim() || null : null;
    const branding = version && menu.branding ? { ...menu.branding, theme: version.branding.theme } : menu.branding;
    return {
      ...menu,
      branding,
      design: full ? publicDesign(draft) : { ...DEFAULT_MENU_DESIGN, accessibility: draft.accessibility },
      announcement: full && draft.announcement.isActive && text ? { text } : null,
      story: version || this.$storyReady() ? story : menu.story,
      chefPicks:
        full && chef?.isActive && this.#visibleChefIds(chef.productIds).length
          ? { title: chef.title.trim() || DEFAULT_CHEF_TITLE, photoUrl: this.$chefPhotoUrl(), productIds: this.#visibleChefIds(chef.productIds) }
          : null,
    };
  });

  constructor() {
    // Otro local: se suelta la foto elegida y la versión que se miraba.
    effect(() => {
      this.$locationId();
      untracked(() => {
        this.#resetChefPhoto();
        this.$viewVersion.set(null);
        this.$designFieldError.set(null);
        this.$chefInvalid.set(null);
      });
    });
    inject(DestroyRef).onDestroy(() => this.#revokeChefPreview());
  }

  /** Lo usa unsavedChangesGuard. */
  hasUnsavedChanges(): boolean {
    return this.$designDirty() || this.$storyDirty() || this.$chefDirty();
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  #tabDirty(tab: Tab): boolean {
    if (tab === 'design') return this.$designDirty() || this.$storyDirty();
    if (tab === 'chef') return this.$chefDirty();
    return false;
  }

  selectTab(tab: Tab) {
    const current = this.$tab();
    if (tab === current) return;
    this.#confirmDiscard(this.#tabDirty(current)).subscribe((confirmed) => {
      if (!confirmed) return;
      if (current === 'design') this.discardDesign();
      if (current === 'chef') this.discardChef();
      this.#navigate({ tab });
    });
  }

  onLocationChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const locationId = Number(select.value) || null;
    this.#confirmDiscard(this.hasUnsavedChanges()).subscribe((confirmed) => {
      if (!confirmed) {
        select.value = String(this.$locationId() ?? '');
        return;
      }
      this.discardDesign();
      this.discardChef();
      this.#navigate({ locationId });
    });
  }

  discardDesign() {
    this.$draftDesign.set(this.$savedDesign());
    this.$draftStory.set(this.$savedStory());
    this.$designFieldError.set(null);
  }

  discardChef() {
    this.$draftChef.set(this.$savedChef());
    this.#resetChefPhoto();
    this.$chefInvalid.set(null);
  }

  onDesignDraft(draft: DesignDraft) {
    this.$draftDesign.set(draft);
    this.$designFieldError.set(null);
  }

  onStory(story: string) {
    this.$draftStory.set(story);
    if (this.$designFieldError()?.field === 'story') this.$designFieldError.set(null);
  }

  onChefDraft(draft: ChefDraft) {
    this.$draftChef.set(draft);
    this.$chefInvalid.set(null);
  }

  onChefPhoto(selection: ImageSelection) {
    this.#revokeChefPreview();
    if (selection.kind === 'set') this.#chefPhotoPreview.set(URL.createObjectURL(selection.file));
    this.$chefPhoto.set(selection);
  }

  async saveDesign() {
    const saved = this.$savedDesign();
    const draft = this.$draftDesign();
    const locationId = this.$locationId();
    if (!saved || !draft || !locationId || this.$isSaving() || this.$designMissing()) return;
    const problem = designProblem(draft) ?? (this.$draftStory().trim().length > STORY_MAX ? `La historia puede tener hasta ${STORY_MAX} caracteres.` : null);
    if (problem) {
      this.#toast.show(problem, 'warning');
      return;
    }
    const timeZone = this.$timeZone();
    const all = designChanges(saved, draft, timeZone);
    // Sin menu_design solo se guarda la accesibilidad (lo demás respondería 403).
    const changes = this.$hasDesign() ? all : all.accessibility ? { accessibility: all.accessibility } : {};
    const storyDirty = this.$storyDirty();
    this.$isSaving.set(true);
    this.$designFieldError.set(null);
    try {
      if (Object.keys(changes).length) {
        const result = await firstValueFrom(this.#designService.updateDesign(locationId, changes));
        // Si mientras tanto se cambió de local, no se pisa lo cargado del otro.
        if (locationId === this.$locationId()) this.$savedDesign.set(designFromDto(result, timeZone));
      }
      if (storyDirty) {
        const result = await firstValueFrom(this.#marketing.updateBranding(locationId, { story: this.$draftStory().trim() || null }));
        if (locationId === this.$locationId()) this.$savedStory.set(result.story ?? '');
      }
      this.#toast.show('Diseño guardado', 'success');
    } catch (error) {
      const field = menuDesignErrorField(error);
      if (field !== null && locationId === this.$locationId()) this.$designFieldError.set({ field, message: menuDesignFieldMessage(field) });
      const message = marketingSaveError(error, 'No se pudo guardar el diseño.');
      if (message) this.#toast.show(message, 'error');
    } finally {
      this.$isSaving.set(false);
    }
  }

  async saveChef() {
    const draft = this.$draftChef();
    const saved = this.$savedChefDto();
    const locationId = this.$locationId();
    if (!draft || !saved || !locationId || this.$isSaving() || this.$chefMissing()) return;
    const problem = chefProblem(draft);
    if (problem) {
      this.#toast.show(problem, 'warning');
      return;
    }
    this.$isSaving.set(true);
    this.$chefInvalid.set(null);
    try {
      const photoFileId = await this.#upload.resolveSelection(this.$chefPhoto(), 'menu_chef');
      const result = await firstValueFrom(this.#designService.saveChefPicks(locationId, chefToDto(draft, photoFileId)));
      if (locationId === this.$locationId()) {
        this.$savedChefDto.set(result);
        this.#resetChefPhoto();
      }
      this.#toast.show('Recomendaciones guardadas', 'success');
    } catch (error) {
      const invalid = chefPicksError(error);
      if (invalid && locationId === this.$locationId()) this.$chefInvalid.set(invalid);
      const message = error instanceof ImageUploadError ? getUploadErrorMessage(error) : marketingSaveError(error, 'No se pudieron guardar las recomendaciones.');
      if (message) this.#toast.show(message, 'error');
    } finally {
      this.$isSaving.set(false);
    }
  }

  viewVersion(version: MenuDesignVersionDto | null) {
    this.$viewVersion.set(version);
    if (version) this.$previewOpen.set(true);
  }

  restoreVersion(version: MenuDesignVersionDto) {
    const locationId = this.$locationId();
    if (!locationId || this.$restoringId() !== null) return;
    const lost = this.$designDirty() || this.$storyDirty() ? ' Los cambios que no guardaste en Diseño se pierden.' : '';
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Volver a este diseño',
          message: `La carta vuelve a verse como el ${this.#formatDate(version.createdAt)}: diseño, colores, portada, historia y anuncio. Lo actual queda guardado en el historial.${lost}`,
          confirmText: 'Volver a este diseño',
          cancelText: 'Cancelar',
        },
      })
      .afterClosed()
      .subscribe(async (confirmed) => {
        if (confirmed !== true) return;
        this.$restoringId.set(version.id);
        try {
          const result = await firstValueFrom(this.#designService.restoreVersion(locationId, version.id));
          if (locationId === this.$locationId()) {
            this.$savedDesign.set(designFromDto(result, this.$timeZone()));
            this.$designFieldError.set(null);
            this.$viewVersion.set(null);
            this.versions.reload();
            // La versión puede incluir colores, portada o historia.
            this.branding.reload();
            this.publicMenu.reload();
          }
          this.#toast.show('Diseño restaurado', 'success');
        } catch (error) {
          const message = marketingSaveError(error, 'No se pudo restaurar el diseño.');
          if (message) this.#toast.show(message, 'error');
        } finally {
          this.$restoringId.set(null);
        }
      });
  }

  /** Como en la carta pública: solo los que se ven en el local y no están agotados. */
  #visibleChefIds(ids: readonly number[]): number[] {
    const catalog = new Map(this.$catalog().map((product) => [product.id, product] as const));
    return ids.filter((id) => {
      const product = catalog.get(id);
      return !!product && !product.soldOut;
    });
  }

  #formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat('es-CL', { timeZone: this.$timeZone() ?? undefined, dateStyle: 'long', timeStyle: 'short' }).format(date);
  }

  #navigate(queryParams: Record<string, unknown>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  #confirmDiscard(dirty: boolean): Observable<boolean> {
    if (!dirty) return of(true);
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Hay cambios sin guardar',
          message: 'Cambiaste el diseño de la carta y no lo guardaste. Si sigues, se pierden.',
          confirmText: 'Descartar cambios',
          cancelText: 'Seguir editando',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(map((confirmed) => confirmed === true));
  }

  #resetChefPhoto() {
    this.#revokeChefPreview();
    this.$chefPhoto.set({ kind: 'keep' });
    this.$chefPickerKey.update((key) => key + 1);
  }

  #revokeChefPreview() {
    const url = this.#chefPhotoPreview();
    if (url) URL.revokeObjectURL(url);
    this.#chefPhotoPreview.set(null);
  }
}
