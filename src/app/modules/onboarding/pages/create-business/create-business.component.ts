import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, OnDestroy, signal, untracked, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent, IconComponent, ImagePickerComponent, ToastService, RedomLogoComponent } from 'src/ui';
import { FileUploadService, getUploadErrorMessage, ImageSelection } from 'src/app/core/services/file-upload';
import { ProfilePhotoService } from 'src/app/modules/profile/data-access';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { AuthService } from 'src/app/modules/auth/pages/data-access';
import { FindAllCurrenciesService, UpdateBusinessLogoService } from 'src/app/modules/restaurante/pages/business/data-access';
import {
  CreateBusinessLocationDto,
  GetAllBusinessLocationsService,
} from 'src/app/modules/restaurante/pages/business-location/data-access';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ApiErrorCode, readApiError } from 'src/app/core/utils/api-error';
import { InventoryLocationStore } from 'src/app/modules/inventory/data-access';
import {
  CreatedLocation,
  LocationDraft,
  ONBOARDING_STEPS,
  OnboardingApiService,
  OnboardingStepId,
  ServiceResult,
} from '../../data-access';
import { StepDoneComponent, StepLocationComponent, StepProductsComponent, StepServiceComponent } from './features';
import { TIME_ZONES } from './time-zones';

type BusinessContext = Readonly<{ id: number; name: string; currencyId: number }>;

// Zona del navegador si está en la lista; si no, Santiago.
function detectTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIME_ZONES.some((option) => option.value === zone) ? zone : 'America/Santiago';
  } catch {
    return 'America/Santiago';
  }
}

/**
 * Onboarding: del registro al primer pedido. "Tu negocio" solo junta los datos; "Tu local" crea negocio (ya activo,
 * el usuario queda OWNER) y local en un solo POST /business. Después: cómo atiende (mesas), primeros productos y foto.
 * Con negocio pero sin locales (recargó, o los desactivó) retoma en "Tu local" y crea solo el local.
 */
@Component({
  selector: 'app-create-business',
  templateUrl: './create-business.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RedomLogoComponent,
    ReactiveFormsModule,
    ButtonComponent,
    IconComponent,
    ImagePickerComponent,
    StepLocationComponent,
    StepServiceComponent,
    StepProductsComponent,
    StepDoneComponent,
  ],
})
export class CreateBusinessComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly whoami = inject(WhoamiService);
  private readonly authService = inject(AuthService);
  private readonly currenciesService = inject(FindAllCurrenciesService);
  private readonly api = inject(OnboardingApiService);
  // Los servicios de locales y configuración se piden recién con el negocio creado: sin él, su GET respondería 403.
  private readonly injector = inject(Injector);
  private readonly upload = inject(FileUploadService);
  private readonly logoService = inject(UpdateBusinessLogoService);
  private readonly photoService = inject(ProfilePhotoService);

  readonly timeZones = TIME_ZONES;
  readonly $currencies = computed(() => this.currenciesService.$currencies() ?? []);

  // --- Pasos ---
  // Quien ya tiene foto de perfil no ve el paso "Tu foto".
  readonly #hadPhoto = !!this.whoami.$whoami()?.user.profileImageUrl;
  readonly $steps = computed(() => ONBOARDING_STEPS.filter((step) => step.id !== 'photo' || !this.#hadPhoto));
  readonly $step = signal<OnboardingStepId>('business');
  readonly $stepIndex = computed(() => this.$steps().findIndex((step) => step.id === this.$step()));
  readonly $current = computed(() => this.$steps()[this.$stepIndex()]);
  // "Paso N de M" no cuenta el "¡Listo!".
  readonly $stepTotal = computed(() => this.$steps().length - 1);
  // Pasos ya guardados en el backend: no se puede volver a ellos.
  readonly $persisted = signal<ReadonlySet<OnboardingStepId>>(new Set());
  readonly $skipped = signal<ReadonlySet<OnboardingStepId>>(new Set());
  // Un paso hijo está guardando.
  readonly $childBusy = signal(false);
  readonly $canGoBack = computed(() => {
    const previous = this.$steps()[this.$stepIndex() - 1];
    return (
      !!previous &&
      this.$step() !== 'done' &&
      !this.$persisted().has(previous.id) &&
      !this.$childBusy() &&
      !this.$isSavingPhoto() &&
      !this.$isCreating()
    );
  });
  readonly $canSkip = computed(() => !!this.$current()?.optional && !this.$childBusy() && !this.$isSavingPhoto());

  // --- Contexto que se va armando ---
  readonly $business = signal<BusinessContext | null>(null);
  // Nombre escrito en "Tu negocio" mientras aún no se crea.
  readonly #draftName = signal('');
  readonly $businessName = computed(() => this.$business()?.name ?? this.#draftName());
  readonly $locationDraft = signal<LocationDraft | null>(null);
  readonly $location = signal<CreatedLocation | null>(null);
  readonly $service = signal<ServiceResult | null>(null);
  readonly $products = signal<string[]>([]);
  readonly $currency = computed(() => {
    const currencyId = this.$business()?.currencyId;
    return this.$currencies().find((currency) => currency.id === currencyId) ?? null;
  });
  readonly $integerPrices = computed(() => (this.$currency()?.code ?? 'CLP') === 'CLP');

  readonly productsStep = viewChild(StepProductsComponent);

  // --- Paso 1: negocio ---
  readonly $isUploading = this.upload.$isUploading;
  readonly $uploadProgress = this.upload.$progress;
  // Creando negocio/local o subiendo el logo.
  readonly $isCreating = signal(false);
  #logo: File | null = null;
  // Vista previa del logo elegido, para que siga visible al volver a "Tu negocio".
  readonly $logoPreview = signal<string | null>(null);
  submitted = false;

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    currencyId: [0, [Validators.min(1)]],
    timeZone: [detectTimeZone()],
  });

  // --- Paso foto ---
  readonly $photoFile = signal<File | null>(null);
  readonly $isSavingPhoto = this.photoService.$isSaving;
  readonly $firstName = computed(() => this.whoami.$whoami()?.user.name?.split(' ')[0] ?? '');

  constructor() {
    // Moneda por defecto: peso chileno si existe.
    effect(() => {
      const currencies = this.$currencies();
      if (!currencies.length || this.form.controls.currencyId.value) return;
      const clp = currencies.find((currency) => currency.code === 'CLP') ?? currencies[0];
      untracked(() => this.form.controls.currencyId.setValue(clp.id));
    });

    this.resumeIfBusinessExists();
  }

  // --- Navegación ---
  next() {
    const target = this.$steps()[this.$stepIndex() + 1];
    if (!target) return;
    this.$step.set(target.id);
  }

  back() {
    if (!this.$canGoBack()) return;
    this.$step.set(this.$steps()[this.$stepIndex() - 1].id);
  }

  skip() {
    if (!this.$canSkip()) return;
    const step = this.$step();
    // Productos: lo que alcanzó a crearse antes de omitir igual cuenta.
    if (step === 'products') {
      const created = this.productsStep()?.createdSoFar() ?? [];
      if (created.length) {
        this.$products.set(created);
        this.markPersisted('products');
      }
    }
    this.$skipped.update((skipped) => new Set(skipped).add(step));
    this.next();
  }

  // --- Paso 1: solo junta los datos (se crean en "Tu local") ---
  submit() {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.show(this.form.controls.name.invalid ? 'Ingresa el nombre de tu negocio' : 'Elige la moneda', 'warning');
      return;
    }
    this.#draftName.set(this.form.getRawValue().name.trim());
    this.next();
  }

  onLogoChange(selection: ImageSelection) {
    if (selection.kind === 'keep') return;
    this.#logo = selection.kind === 'set' ? selection.file : null;
    this.#setLogoPreview(this.#logo ? URL.createObjectURL(this.#logo) : null);
  }

  // --- Paso 2 ---
  onLocationSubmitted(location: CreateBusinessLocationDto) {
    if (this.$isCreating()) return;
    if (this.$persisted().has('business')) this.createLocationOnly(location);
    else this.createBusinessWithLocation(location);
  }

  /** Un solo POST /business con el local. Luego whoami (restaurantId, OWNER, permisos) y el logo, que necesita el id. */
  private async createBusinessWithLocation(location: CreateBusinessLocationDto) {
    const { name, currencyId, timeZone } = this.form.getRawValue();
    const businessName = name.trim();
    this.$isCreating.set(true);
    let created: { id: number; locationId?: number };
    try {
      created = await firstValueFrom(this.api.createBusiness({ name: businessName, currencyId, timeZone, location }));
    } catch (error) {
      this.$isCreating.set(false);
      this.handleCreateError(error);
      return;
    }

    this.$business.set({ id: created.id, name: businessName, currencyId });
    this.markPersisted('business');
    // Al instante, por si whoami tarda o falla (los guards leen esto).
    this.whoami.patchUser({ restaurantId: created.id, businessName, locationsCount: created.locationId ? 1 : 0 });
    await firstValueFrom(this.whoami.load());

    if (this.#logo) {
      try {
        const { fileId } = await this.upload.uploadImage(this.#logo, 'business_logos');
        await firstValueFrom(this.logoService.update(created.id, fileId));
      } catch {
        this.toast.show('No se pudo subir el logo, puedes intentarlo desde Mi negocio', 'warning');
      }
    }
    this.$isCreating.set(false);

    if (created.locationId) {
      this.toast.show('¡Negocio y local creados!', 'success');
      this.onLocationCreated({ id: created.locationId, name: location.name });
      return;
    }
    // El backend siempre debería devolver locationId: si no, se crea el local aparte.
    this.createLocationOnly(location);
  }

  /** Negocio ya existente (retomado): solo el local, con POST /business-locations. */
  private createLocationOnly(location: CreateBusinessLocationDto) {
    this.$isCreating.set(true);
    this.api.createLocation(location).subscribe({
      next: ({ id }) => {
        this.$isCreating.set(false);
        this.toast.show('¡Local creado!', 'success');
        this.onLocationCreated({ id, name: location.name });
        this.whoami.load().subscribe();
      },
      error: (error) => {
        this.$isCreating.set(false);
        const { status } = readApiError(error);
        this.toast.show(
          status === 0 ? 'No hay conexión con el servidor.' : 'No se pudo crear el local. Intenta nuevamente.',
          'error',
        );
      },
    });
  }

  private onLocationCreated(location: CreatedLocation) {
    this.$location.set(location);
    this.markPersisted('location');
    if (!this.whoami.$whoami()?.user.locationsCount) this.whoami.patchUser({ locationsCount: 1 });
    // El POS y el inventario toman este local (la lista se recarga: puede venir vacía en caché).
    this.injector.get(InventoryLocationStore).select(location.id);
    this.injector.get(GetAllBusinessLocationsService).retry();
    this.next();
  }

  // --- Paso 3 ---
  onServiceCompleted(result: ServiceResult) {
    this.$service.set(result);
    this.markPersisted('service');
    this.saveTablesEnabled(result.mode !== 'counter');
    this.next();
  }

  // --- Paso 4 ---
  onProductsCompleted(names: string[]) {
    this.$products.set(names);
    this.markPersisted('products');
    this.toast.show(names.length === 1 ? 'Producto creado' : `${names.length} productos creados`, 'success');
    this.next();
  }

  // --- Paso foto ---
  onPhotoChange(selection: ImageSelection) {
    this.$photoFile.set(selection.kind === 'set' ? selection.file : null);
  }

  async savePhoto() {
    const file = this.$photoFile();
    if (!file) return this.next();
    try {
      await this.photoService.set(file);
      this.markPersisted('photo');
      this.toast.show('¡Listo! Ya tienes foto de perfil', 'success');
      this.next();
    } catch (error) {
      this.toast.show(getUploadErrorMessage(error), 'error');
    }
  }

  logout() {
    this.authService.logout().subscribe({ error: () => undefined });
    this.whoami.forget();
    this.router.navigateByUrl('/auth/sign-in');
  }

  ngOnDestroy(): void {
    this.#setLogoPreview(null);
  }

  private markPersisted(step: OnboardingStepId) {
    this.$persisted.update((persisted) => new Set(persisted).add(step));
  }

  /** El POS muestra mesas según cómo atiende (Mostrador → no). Si falla se avisa y se sigue: se cambia en Mi negocio. */
  private saveTablesEnabled(tablesEnabled: boolean) {
    const business = this.$business();
    if (!business) return;
    this.api.updateTablesEnabled(business.id, tablesEnabled).subscribe({
      next: () => this.injector.get(BusinessSettingsService).reload(),
      error: () => this.toast.show('No pudimos guardar si atiendes con mesas. Puedes cambiarlo en Mi negocio.', 'warning'),
    });
  }

  #setLogoPreview(url: string | null) {
    const previous = this.$logoPreview();
    if (previous) URL.revokeObjectURL(previous);
    this.$logoPreview.set(url);
  }

  /** El guard deja entrar al dueño con negocio y sin locales: se retoma en "Tu local". */
  private resumeIfBusinessExists() {
    const user = this.whoami.$whoami()?.user;
    const restaurantId = user?.restaurantId;
    if (!restaurantId) return;
    this.markPersisted('business');
    this.$step.set('location');
    // Nombre al tiro desde whoami; la moneda llega con el negocio.
    if (user.businessName) this.$business.set({ id: restaurantId, name: user.businessName, currencyId: 0 });
    this.api.findBusiness(restaurantId).subscribe({
      next: (business) => {
        if (business) this.$business.set({ id: business.id, name: business.name, currencyId: business.currencyId });
      },
      error: () => {
        if (!this.$business()) this.$business.set({ id: restaurantId, name: '', currencyId: 0 });
        this.toast.show('No pudimos cargar tu negocio. Recarga la página si algo no se ve bien.', 'warning');
      },
    });
  }

  /**
   * 409: el usuario ya tiene negocio (BUSINESS_ALREADY_EXISTS) o ya pertenece a otro (USER_ALREADY_IN_BUSINESS).
   * Se recarga whoami: si es dueño y le falta el local se sigue aquí en "Tu local"; si no, entra a la app.
   * Un 409 sin código se trata igual.
   */
  private handleCreateError(error: unknown) {
    const { status, code } = readApiError(error);
    if (status === 409) {
      const memberElsewhere = code === ApiErrorCode.USER_ALREADY_IN_BUSINESS;
      this.whoami.load().subscribe((whoami) => {
        if (!whoami?.user.restaurantId) {
          this.toast.show('Tu cuenta ya pertenece a un negocio. Cierra sesión y vuelve a entrar.', 'error');
          return;
        }
        this.whoami.needsOnboarding(whoami).subscribe((pending) => {
          if (pending && !memberElsewhere) {
            this.toast.show('Tu negocio ya estaba creado. Confirma para crear tu local.', 'success');
            this.resumeIfBusinessExists();
            return;
          }
          this.toast.show(
            memberElsewhere ? 'Tu cuenta ya pertenece a un negocio. Te llevamos al panel.' : 'Tu cuenta ya tiene un negocio. Te llevamos al panel.',
            'warning',
          );
          this.router.navigateByUrl('/dashboard/admin');
        });
      });
      return;
    }
    const message =
      status === 0
        ? 'No hay conexión con el servidor.'
        : status === 400
          ? 'Revisa los datos de tu negocio y de tu local.'
          : 'No se pudo crear el negocio. Intenta nuevamente.';
    this.toast.show(message, 'error');
  }
}
