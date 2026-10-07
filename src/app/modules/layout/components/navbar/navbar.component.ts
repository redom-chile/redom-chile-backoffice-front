import { Component, OnInit, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { MenuService } from '../../services/menu.service';
import { NavbarMenuComponent } from './navbar-menu/navbar-menu.component';
import { NavbarMobileComponent } from './navbar-mobile/navbar-mobilecomponent';
import { ProfileMenuComponent } from './profile-menu/profile-menu.component';
import { IconComponent, RedomLogoComponent } from 'src/ui';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RedomLogoComponent, RouterLink, AngularSvgIconModule, NavbarMenuComponent, ProfileMenuComponent, NavbarMobileComponent, IconComponent],
})
export class NavbarComponent implements OnInit {
  readonly #settings = inject(BusinessSettingsService);
  readonly #whoami = inject(WhoamiService);

  // Nombre del negocio: el de la configuración (se actualiza al editarlo en Mi negocio) o el de whoami mientras carga.
  readonly $businessName = computed(() => this.#settings.$settings()?.name || this.#whoami.$whoami()?.user.businessName || null);

  constructor(private menuService: MenuService) {}

  ngOnInit(): void {}

  public toggleMobileMenu(): void {
    this.menuService.showMobileMenu = true;
  }

  public toggleMobileSidebar(): void {
    this.menuService.toggleMobileSidebar();
  }
}
