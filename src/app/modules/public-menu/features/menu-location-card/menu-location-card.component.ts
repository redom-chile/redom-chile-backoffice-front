import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import {
  getPublicMenuErrorMessage,
  MenuSettingsDto,
  MenuSettingsService,
  UpdateMenuSettingsDto,
} from 'src/app/modules/public-menu/data-access';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ToastService, ToggleComponent } from 'src/ui';
import { environment } from 'src/environments/environment';
import { CustomerOrderSettingsComponent } from '../customer-order-settings';
import { SlugEditorComponent } from '../slug-editor';
import { downloadMenuQr, toFileSlug } from './menu-qr';

type TextField = 'description' | 'address' | 'phone' | 'whatsapp' | 'instagram' | 'website' | 'googleReviewUrl';
type FormField = TextField | 'latitude' | 'longitude';

const MAX_LENGTH: Record<TextField, number> = {
  description: 500,
  address: 300,
  phone: 30,
  whatsapp: 30,
  instagram: 60,
  website: 200,
  googleReviewUrl: 300,
};

const toText = (value: string | null | undefined) => (value ?? '').trim() || null;
const toNumber = (value: string) => {
  const text = value.trim().replace(',', '.');
  return text === '' ? null : Number(text);
};
const savedNumber = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === '' ? null : Number(value);

/** Tarjeta de la carta de un local: URL y QR, publicación, datos públicos, pedidos y dirección (slug). */
@Component({
  selector: 'app-menu-location-card',
  imports: [ButtonComponent, ToggleComponent, CheckPermissionDirective, SlugEditorComponent, CustomerOrderSettingsComponent],
  templateUrl: './menu-location-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuLocationCardComponent {
  readonly #service = inject(MenuSettingsService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly maxLength = MAX_LENGTH;

  readonly settings = input.required<MenuSettingsDto>();
  readonly businessName = input('');
  readonly changed = output<MenuSettingsDto[]>();

  readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));
  readonly $id = computed(() => `menu-${this.settings().locationId}`);
  readonly $url = computed(() => {
    const path = this.settings().publicPath;
    return path ? `${environment.publicSiteUrl}${path}` : null;
  });
  readonly $slugPrefix = computed(() => `/carta/${this.settings().businessSlug ?? ''}/`);

  readonly $isPublishing = signal(false);
  readonly $published = linkedSignal(() => this.settings().isPublished);
  readonly $isSaving = signal(false);

  // Textos de los inputs.
  readonly $description = linkedSignal(() => this.settings().description ?? '');
  readonly $address = linkedSignal(() => this.settings().address ?? '');
  readonly $latitude = linkedSignal(() => this.#numberText(this.settings().latitude));
  readonly $longitude = linkedSignal(() => this.#numberText(this.settings().longitude));
  readonly $phone = linkedSignal(() => this.settings().phone ?? '');
  readonly $whatsapp = linkedSignal(() => this.settings().whatsapp ?? '');
  readonly $instagram = linkedSignal(() => this.settings().instagram ?? '');
  readonly $website = linkedSignal(() => this.settings().website ?? '');
  readonly $googleReviewUrl = linkedSignal(() => this.settings().googleReviewUrl ?? '');

  readonly #fields = {
    description: this.$description,
    address: this.$address,
    latitude: this.$latitude,
    longitude: this.$longitude,
    phone: this.$phone,
    whatsapp: this.$whatsapp,
    instagram: this.$instagram,
    website: this.$website,
    googleReviewUrl: this.$googleReviewUrl,
  } as const;

  readonly $errors = computed(() => {
    const errors: Partial<Record<FormField, string>> = {};
    for (const field of Object.keys(MAX_LENGTH) as TextField[]) {
      if (this.#fields[field]().trim().length > MAX_LENGTH[field]) errors[field] = `Máximo ${MAX_LENGTH[field]} caracteres.`;
    }
    for (const field of ['website', 'googleReviewUrl'] as const) {
      const value = this.#fields[field]().trim();
      if (value && !errors[field] && !/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(value)) errors[field] = 'Debe empezar con https://';
    }
    const latitude = toNumber(this.$latitude());
    const longitude = toNumber(this.$longitude());
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) errors.latitude = 'Entre -90 y 90.';
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) errors.longitude = 'Entre -180 y 180.';
    if (!errors.latitude && !errors.longitude && (latitude === null) !== (longitude === null)) {
      errors[latitude === null ? 'latitude' : 'longitude'] = 'Completa latitud y longitud.';
    }
    return errors;
  });
  readonly $isValid = computed(() => Object.keys(this.$errors()).length === 0);

  readonly $mapUrl = computed(() => {
    const latitude = toNumber(this.$latitude());
    const longitude = toNumber(this.$longitude());
    if (latitude === null || longitude === null || this.$errors().latitude || this.$errors().longitude) return null;
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  });

  /** Solo los campos que cambiaron (vacío = null). */
  readonly #changes = computed<UpdateMenuSettingsDto>(() => {
    const saved = this.settings();
    const changes: Record<string, string | number | null> = {};
    for (const field of Object.keys(MAX_LENGTH) as TextField[]) {
      const value = toText(this.#fields[field]());
      if (value !== toText(saved[field])) changes[field] = value;
    }
    for (const field of ['latitude', 'longitude'] as const) {
      const value = toNumber(this.#fields[field]());
      if (value !== savedNumber(saved[field])) changes[field] = value;
    }
    return changes as UpdateMenuSettingsDto;
  });
  readonly $hasChanges = computed(() => Object.keys(this.#changes()).length > 0);

  onText(field: FormField, event: Event) {
    this.#fields[field].set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  async copy() {
    const url = this.$url();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.#toast.show('Dirección copiada', 'success');
    } catch {
      this.#toast.show('No se pudo copiar la dirección', 'error');
    }
  }

  open() {
    const url = this.$url();
    if (url) window.open(url, '_blank', 'noopener');
  }

  async downloadQr() {
    const url = this.$url();
    if (!url) return;
    try {
      const name = `carta-${toFileSlug(this.businessName() || this.settings().businessSlug)}-${toFileSlug(this.settings().locationName)}.png`;
      await downloadMenuQr(url, name);
    } catch {
      this.#toast.show('No se pudo generar el QR', 'error');
    }
  }

  setPublished(isPublished: boolean) {
    this.$published.set(isPublished);
    this.$isPublishing.set(true);
    this.#service.update(this.settings().locationId, { isPublished }).subscribe({
      next: (settings) => {
        this.$isPublishing.set(false);
        this.#toast.show(isPublished ? 'Carta publicada' : 'Carta sin publicar', 'success');
        this.changed.emit([settings]);
      },
      error: (error: unknown) => {
        this.$isPublishing.set(false);
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo cambiar la publicación.'), 'error');
        this.$published.set(!isPublished);
      },
    });
  }

  save() {
    if (!this.$hasChanges() || !this.$isValid() || this.$isSaving()) return;
    this.$isSaving.set(true);
    this.#service.update(this.settings().locationId, this.#changes()).subscribe({
      next: (settings) => {
        this.$isSaving.set(false);
        this.#toast.show('Datos guardados', 'success');
        this.changed.emit([settings]);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudieron guardar los datos.'), 'error');
      },
    });
  }

  discard() {
    for (const field of Object.keys(this.#fields) as FormField[]) {
      const saved = this.settings()[field];
      this.#fields[field].set(field === 'latitude' || field === 'longitude' ? this.#numberText(saved as number | null) : ((saved as string | null) ?? ''));
    }
  }

  #numberText(value: number | string | null | undefined): string {
    const number = savedNumber(value);
    return number === null || !Number.isFinite(number) ? '' : String(number);
  }
}
