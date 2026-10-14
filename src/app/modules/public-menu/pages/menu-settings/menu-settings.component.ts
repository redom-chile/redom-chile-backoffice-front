import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { SupportModeService } from 'src/app/core/services/support-mode';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { getPublicMenuErrorMessage, MenuSettingsDto, MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { MenuLocationCardComponent } from 'src/app/modules/public-menu/features/menu-location-card';
import { SlugEditorComponent } from 'src/app/modules/public-menu/features/slug-editor';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { environment } from 'src/environments/environment';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';

/** Configuración → Carta pública: dirección del negocio y una tarjeta por local. */
@Component({
  selector: 'app-menu-settings',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    CheckPermissionDirective,
    MenuLocationCardComponent,
    SlugEditorComponent,
  ],
  templateUrl: './menu-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuSettingsComponent {
  readonly #service = inject(MenuSettingsService);
  readonly #business = inject(BusinessSettingsService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly $supportMode = inject(SupportModeService).$active;
  readonly $businessName = computed(() => this.#business.$settings()?.name ?? '');
  readonly businessPrefix = `${environment.publicSiteUrl.replace(/^https?:\/\//, '')}/carta/`;

  readonly settings = rxResource({ stream: () => this.#service.getSettings().pipe(toRemoteResult()) });

  // Lista local: lo guardado en una tarjeta reemplaza su local sin recargar todo.
  readonly $list = linkedSignal<MenuSettingsDto[] | null>(() => resultValue(this.settings.value()));
  readonly $businessSlug = computed(() => this.$list()?.[0]?.businessSlug ?? null);
  readonly $error = computed(() => resultError(this.settings.value()));
  readonly $errorMessage = computed(() => getPublicMenuErrorMessage(this.$error(), 'No se pudieron cargar las cartas.'));
  readonly $isFirstLoad = computed(() => this.settings.isLoading() && !this.$list());

  onChanged(updated: MenuSettingsDto[]) {
    this.$list.update((list) => {
      if (!list) return updated;
      const byId = new Map(updated.map((item) => [item.locationId, item]));
      return list.map((item) => byId.get(item.locationId) ?? item);
    });
  }

  // El slug del negocio devuelve todas las cartas.
  onBusinessSlugSaved(list: MenuSettingsDto[]) {
    this.$list.set(list);
  }
}
