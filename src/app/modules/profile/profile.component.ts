import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { AuthService } from 'src/app/modules/auth/pages/data-access';
import { FindMyBusinessesService } from 'src/app/modules/restaurante/pages/business/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import { GetProfileService } from './data-access';
import {
  ChangePasswordModalComponent,
  ChangePasswordModalData,
  ContactSectionComponent,
  PersonalInfoSectionComponent,
  ProfileBusiness,
  ProfileHeroCardComponent,
  LegalDocumentsSectionComponent,
  SecuritySectionComponent,
  UpdateContactModalComponent,
} from './features';
import { ProfileSkeletonComponent } from './ui';

@Component({
  selector: 'app-profile',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    ProfileHeroCardComponent,
    PersonalInfoSectionComponent,
    ContactSectionComponent,
    SecuritySectionComponent,
    LegalDocumentsSectionComponent,
    ProfileSkeletonComponent,
  ],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  readonly #auth = inject(AuthService);
  readonly #whoami = inject(WhoamiService);
  readonly #profileService = inject(GetProfileService);
  readonly #businesses = inject(FindMyBusinessesService);

  protected readonly $profile = this.#profileService.$profile;
  protected readonly $hasError = this.#profileService.$hasError;
  protected readonly $roles = computed(() => this.#whoami.$whoami()?.roles ?? []);
  protected readonly $userCode = signal<string | null>(null);
  protected readonly $loggingOut = signal(false);

  protected readonly $business = computed<ProfileBusiness | null>(() => {
    if (!this.#whoami.$whoami()?.user.restaurantId) return null;
    const business = this.#businesses.$current();
    return business ? { name: business.name, logoUrl: business.logoUrl } : null;
  });

  constructor() {
    // whoami es la fuente de verdad (código del usuario y negocio); se pide fresco al entrar.
    this.#whoami.load().subscribe((whoami) => {
      const code = whoami?.user.code ?? this.#storedUserCode();
      if (!code) return;
      this.$userCode.set(code);
      this.#profileService.loadProfile(code);
      if (whoami?.user.restaurantId) this.#businesses.retry();
    });
  }

  protected retry() {
    const code = this.$userCode();
    if (code) this.#profileService.loadProfile(code);
  }

  protected openContactModal() {
    this.#dialog
      .open(UpdateContactModalComponent, { width: '90%', maxWidth: '640px', data: this.$profile() })
      .afterClosed()
      .subscribe(() => this.#profileService.reload());
  }

  protected openChangePassword() {
    const profile = this.$profile();
    const userCode = this.$userCode();
    if (!profile || !userCode) return;
    this.#dialog.open<ChangePasswordModalComponent, ChangePasswordModalData>(ChangePasswordModalComponent, {
      width: '90%',
      maxWidth: '480px',
      data: { userCode, email: profile.email },
    });
  }

  protected logout() {
    this.$loggingOut.set(true);
    this.#auth
      .logout()
      .pipe(finalize(() => this.#router.navigateByUrl('/auth/sign-in')))
      .subscribe({ error: () => undefined });
  }

  #storedUserCode(): string | null {
    try {
      return JSON.parse(localStorage.getItem('userData') ?? '{}').code ?? null;
    } catch {
      return null;
    }
  }
}
