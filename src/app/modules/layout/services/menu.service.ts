import { computed, inject, Injectable, Injector, OnDestroy, signal, Signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Menu } from 'src/app/core/constants/menu';
import { MenuItem, SubMenuItem } from 'src/app/core/models/menu.model';
import { AccessService, isPublicUrl, permissionForUrl } from 'src/app/core/permissions';
import { isSuperAdminUrl, WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { isSupportUrl, SupportModeService } from 'src/app/core/services/support-mode';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { EntitlementsService, planFeaturesForUrl } from 'src/app/core/services/entitlements';

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
  #entitlements = inject(EntitlementsService);
  #support = inject(SupportModeService);
  #access = inject(AccessService);
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
    // Lo que el plan no incluye se muestra con candado (no se oculta): al entrar, planFeatureGuard ofrece mejorar el plan.
    this.#entitlements.$entitlements();
    const isLocked = (route: string | null | undefined) => !this.#entitlements.hasFeatures(planFeaturesForUrl(route));
    // Se hereda del ítem original (no se copia) para que siga viendo el expanded/active que le marca la navegación.
    const derive = (item: SubMenuItem, changes: Partial<SubMenuItem>) => Object.assign(Object.create(item) as SubMenuItem, changes);
    // El SUPERADMIN no gestiona negocios: solo ve la plataforma y el centro de ayuda.
    // En modo soporte, solo la carta del negocio que lo autorizó (con los candados de su plan).
    if (roles.has('SUPERADMIN')) {
      if (this.#support.$active()) {
        return this._pagesMenu()
          .map((group) => ({
            ...group,
            items: group.items.flatMap((item) => {
              if (!item.children) return isSupportUrl(item.route) ? [isLocked(item.route) ? derive(item, { locked: true }) : item] : [];
              const children = item.children
                .filter((child) => isVisible(child) && isSupportUrl(child.route))
                .map((child) => (isLocked(child.route) ? derive(child, { locked: true }) : child));
              return children.length ? [derive(item, { children })] : [];
            }),
          }))
          .filter((group) => group.items.length > 0);
      }
      return this._pagesMenu()
        .map((group) => ({ ...group, items: group.items.filter((item) => isVisible(item) && isSuperAdminUrl(item.route)) }))
        .filter((group) => group.items.length > 0);
    }
    return this._pagesMenu().map((group) => ({
      ...group,
      items: group.items.filter(isVisible).map((item) => {
        if (!item.children) return isLocked(item.route) ? derive(item, { locked: true }) : item;
        const children = item.children.filter(isVisible).map((child) => (isLocked(child.route) ? derive(child, { locked: true }) : child));
        const changed = children.length !== item.children.length || children.some((child, i) => child !== item.children![i]);
        if (!changed) return item;
        return derive(item, { children, locked: children.length > 0 && children.every((child) => child.locked) });
      }),
    }));
  });

  // Oculta lo que el rol no puede ver: el `see-module` de cada pantalla (permission-routes.ts), o `permission` si el ítem lo fija.
  // Un grupo con hijos se muestra si queda alguno visible. El plan no oculta: pone el candado (#featureMenu).
  #filteredPagesMenu: Signal<MenuItem[]> = computed(() => {
    const menus = this.#featureMenu();
    if (this.#access.$unrestricted()) return menus;
    this.#access.$permissions();
    const allowed = (item: SubMenuItem) => {
      const permission = item.permission ?? permissionForUrl(item.route);
      return permission ? this.#access.can(permission) : isPublicUrl(item.route);
    };
    const derive = (item: SubMenuItem, changes: Partial<SubMenuItem>) => Object.assign(Object.create(item) as SubMenuItem, changes);

    return menus
      .map((group) => ({
        ...group,
        items: group.items.flatMap((item) => {
          if (!item.children?.length) return allowed(item) ? [item] : [];
          const children = item.children.filter(allowed);
          if (!children.length) return [];
          return children.length === item.children.length ? [item] : [derive(item, { children })];
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
