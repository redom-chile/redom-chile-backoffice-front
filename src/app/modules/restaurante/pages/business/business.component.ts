import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { FindMyBusinessesService } from './data-access';
import { BusinessDetailComponent, InventorySettingsComponent, SupportAccessComponent } from './features';
import { BusinessDetailSkeletonComponent } from './ui';

type BusinessTab = 'general' | 'inventario' | 'soporte';

function toTab(value: string | null): BusinessTab {
  return value === 'inventario' || value === 'soporte' ? value : 'general';
}

@Component({
  selector: 'app-business',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    BusinessDetailComponent,
    BusinessDetailSkeletonComponent,
    EmptyStateComponent,
    InventorySettingsComponent,
    SupportAccessComponent,
  ],
  templateUrl: './business.component.html',
  styleUrl: './business.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly $findMyBusinessesService = inject(FindMyBusinessesService);
  readonly #settings = inject(BusinessSettingsService);

  readonly #whoami = inject(WhoamiService);

  // "Soporte" (acceso de Redom a la carta) es solo del dueño; se oculta también si el backend responde 403.
  readonly #supportDenied = signal(false);
  readonly $canSeeSupport = computed(
    () => !this.#supportDenied() && !!this.#whoami.$whoami()?.roles.some((role) => role.code === 'OWNER'),
  );
  readonly $tabs = computed<ReadonlyArray<{ value: BusinessTab; label: string }>>(() => [
    { value: 'general', label: 'General' },
    { value: 'inventario', label: 'Inventario' },
    ...(this.$canSeeSupport() ? [{ value: 'soporte' as const, label: 'Soporte' }] : []),
  ]);
  // Pestaña sincronizada con ?tab=inventario|soporte (sin parámetro = General).
  readonly #queryTab = toSignal(this.route.queryParamMap.pipe(map((params) => toTab(params.get('tab')))), {
    initialValue: toTab(this.route.snapshot.queryParamMap.get('tab')),
  });
  readonly $tab = computed<BusinessTab>(() => (this.#queryTab() === 'soporte' && !this.$canSeeSupport() ? 'general' : this.#queryTab()));

  constructor() {
    this.$findMyBusinessesService.retry();
  }

  get business() {
    return this.$findMyBusinessesService.$current();
  }

  get isLoading() {
    return this.$findMyBusinessesService.$isLoading();
  }

  retry() {
    this.$findMyBusinessesService.retry();
    this.#settings.reload();
  }

  selectTab(tab: BusinessTab) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'general' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  hideSupport() {
    this.#supportDenied.set(true);
  }

  // Sin negocio: se crea desde el onboarding.
  goToOnboarding() {
    this.router.navigate(['/onboarding']);
  }
}
