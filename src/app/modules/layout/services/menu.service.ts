import { computed, inject, Injectable, Injector, OnDestroy, signal, Signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Menu } from 'src/app/core/constants/menu';
import { MenuItem, SubMenuItem } from 'src/app/core/models/menu.model';
import { environment } from 'src/environments/environment';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';

@Injectable({
  providedIn: 'root',
})
export class MenuService implements OnDestroy {
  private _showSidebar = signal(true);
  private _showMobileMenu = signal(false);
  private _showMobileSidebar = signal(false);
  private _pagesMenu = signal<MenuItem[]>([]);
  private _subscription = new Subscription();
  private _whoamiService = inject(WhoamiService);
  #businessSettings = inject(BusinessSettingsService);
  #injector = inject(Injector);

  // Los locales se piden recién cuando el inventario está activo (el servicio dispara la carga al crearse).
  // Mientras no se conocen, lo que depende de varios locales queda oculto.
  #hasManyLocations = computed(() => {
    if (!this.#businessSettings.$inventoryEnabled()) return false;
    const locationsService = untracked(() => this.#injector.get(GetAllBusinessLocationsService));
    return (locationsService.$locations()?.length ?? 0) > 1;
  });

  #roles = computed(() => new Set(this._whoamiService.$whoami()?.roles.map((role) => role.code) ?? []));

  // Oculta lo que depende de una función apagada en la configuración del negocio (ej. Inventario)
  // y lo reservado a un rol (ej. la administración del centro de ayuda).
  #featureMenu: Signal<MenuItem[]> = computed(() => {
    const enabled = {
      inventory: this.#businessSettings.$inventoryEnabled(),
      ingredients: this.#businessSettings.$ingredientsEnabled(),
      multiLocation: this.#hasManyLocations(),
    };
    const roles = this.#roles();
    const isVisible = (item: SubMenuItem) =>
      (!item.feature || enabled[item.feature]) && (!item.role || roles.has(item.role));
    return this._pagesMenu().map((group) => ({
      ...group,
      items: group.items.filter(isVisible).map((item) => {
        if (!item.children?.some((child) => !isVisible(child))) return item;
        // Se hereda del ítem original (no se copia) para que siga viendo el expanded/active que le marca la navegación.
        return Object.assign(Object.create(item) as SubMenuItem, { children: item.children.filter(isVisible) });
      }),
    }));
  });

  #filteredPagesMenu: Signal<MenuItem[]> = computed(() => {
    const permissions = this._whoamiService.$permissionsSet();
    const menus = this.#featureMenu();
    // Con los permisos apagados (environment.enforcePermissions) se muestra el menú completo.
    if (!environment.enforcePermissions) return menus;

    return menus
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!item.permission) return true;

          if (item.children) {
            const filteredChildren = item.children.filter((child) => {
              if (!child.permission) return true;
              return permissions.has(child.permission);
            });
            return filteredChildren.length > 0;
          }

          return permissions.has(item.permission);
        }),
      }))
      .filter((group) => group.items.length > 0);
  });

  constructor(private router: Router) {
    /** Set dynamic menu */
    this._pagesMenu.set(Menu.pages);

    let sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        /** Expand menu base on active route */
        this._pagesMenu().forEach((menu) => {
          let activeGroup = false;
          menu.items.forEach((subMenu) => {
            // Activo si coincide su ruta o la de alguno de sus hijos (p. ej. /orders está dentro de POS).
            const active =
              this.isActive(subMenu.route) || !!subMenu.children?.some((child) => this.isActive(child.route));
            subMenu.expanded = active;
            subMenu.active = active;
            if (active) activeGroup = true;
            if (subMenu.children) {
              this.expand(subMenu.children);
            }
          });
          menu.active = activeGroup;
        });
      }
    });
    this._subscription.add(sub);
  }

  get showSideBar() {
    return this._showSidebar();
  }
  get showMobileMenu() {
    return this._showMobileMenu();
  }
  get pagesMenu(): MenuItem[] {
    return this.#filteredPagesMenu();
  }

  set showSideBar(value: boolean) {
    this._showSidebar.set(value);
  }
  set showMobileMenu(value: boolean) {
    this._showMobileMenu.set(value);
  }

  get showMobileSidebar() {
    return this._showMobileSidebar();
  }

  set showMobileSidebar(value: boolean) {
    this._showMobileSidebar.set(value);
  }

  public toggleMobileSidebar() {
    this._showMobileSidebar.set(!this._showMobileSidebar());
  }

  public toggleSidebar() {
    this._showSidebar.set(!this._showSidebar());
  }

  public toggleMenu(menu: any) {
    this.showSideBar = true;
    menu.expanded = !menu.expanded;
  }

  public toggleSubMenu(submenu: SubMenuItem) {
    submenu.expanded = !submenu.expanded;
  }

  private expand(items: Array<any>) {
    items.forEach((item) => {
      item.expanded = this.isActive(item.route);
      if (item.children) this.expand(item.children);
    });
  }

  public isActive(instruction: any): boolean {
    return this.router.isActive(this.router.createUrlTree([instruction]), {
      paths: 'subset',
      queryParams: 'subset',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }

  ngOnDestroy(): void {
    this._subscription.unsubscribe();
  }
}
