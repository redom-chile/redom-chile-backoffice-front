import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { throttledRefresh } from 'src/app/core/services/file-upload';
import { ButtonComponent, CardComponent, IconComponent, ImageThumbComponent, SkeletonComponent } from 'src/ui';
import { BusinessDto, FindMyBusinessesService } from '../../data-access';
import { BusinessCurrencySectionComponent } from '../business-currency-section';
import { BusinessIdentitySectionComponent } from '../business-identity-section';
import { BusinessPosSectionComponent } from '../business-pos-section';
import { BusinessTaxSectionComponent } from '../business-tax-section';

/** Pestaña "General" de Mi negocio: secciones editables y datos de solo lectura. */
@Component({
  selector: 'app-business-detail',
  imports: [
    DatePipe,
    RouterLink,
    CardComponent,
    ButtonComponent,
    IconComponent,
    ImageThumbComponent,
    SkeletonComponent,
    BusinessIdentitySectionComponent,
    BusinessCurrencySectionComponent,
    BusinessTaxSectionComponent,
    BusinessPosSectionComponent,
  ],
  templateUrl: './business-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessDetailComponent {
  readonly #settings = inject(BusinessSettingsService);
  readonly #businesses = inject(FindMyBusinessesService);

  readonly business = input.required<BusinessDto>();

  protected readonly $settings = this.#settings.$settings;
  protected readonly $settingsLoaded = this.#settings.$isLoaded;
  protected readonly $settingsError = this.#settings.$hasError;
  protected readonly $name = computed(() => this.$settings()?.name ?? this.business().name);

  // La URL del logo vence en 1 hora: se vuelve a pedir el negocio.
  protected readonly refreshExpiredLogo = throttledRefresh(() => this.#businesses.retry());

  retrySettings() {
    this.#settings.reload();
  }
}
