import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';
import { unsavedChangesGuard } from 'src/app/modules/inventory/shared/data-access';
import { CashRegistersComponent, PaymentMethodsComponent, PrinterListComponent, PrintStationComponent, SchedulesComponent, StationListComponent, TerminalSetupComponent } from './pages';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'stations', pathMatch: 'full' },
      { path: 'stations', component: StationListComponent },
      { path: 'printers', component: PrinterListComponent },
      { path: 'print-station', component: PrintStationComponent },
      { path: 'schedules', component: SchedulesComponent },
      { path: 'terminal', component: TerminalSetupComponent },
      { path: 'registers', component: CashRegistersComponent },
      // Carta pública por local (los clientes la ven en la landing: /carta/{negocio}/{local}).
      {
        path: 'public-menu',
        pathMatch: 'full',
        loadComponent: () => import('src/app/modules/public-menu/pages/menu-settings').then((m) => m.MenuSettingsComponent),
      },
      // Promociones, banners y personalización. Query params opcionales: tab (promotions|banners|branding), locationId.
      {
        path: 'public-menu/marketing',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('src/app/modules/public-menu/pages/menu-marketing').then((m) => m.MenuMarketingComponent),
      },
      // Traducciones de la carta. Query params opcionales: language, status.
      {
        path: 'menu-translations',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('src/app/modules/public-menu/pages/menu-translations').then((m) => m.MenuTranslationsComponent),
      },
      // Etapa 8: diseño de la carta y recomendaciones del chef. Query params opcionales: locationId, tab (design|chef|history).
      {
        path: 'public-menu/design',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('src/app/modules/public-menu/pages/menu-design').then((m) => m.MenuDesignComponent),
      },
      // Llaves, webhooks y widget de la API pública. Query param opcional: tab (keys|webhooks|widget).
      {
        path: 'public-api',
        loadComponent: () => import('src/app/modules/public-menu/pages/public-api').then((m) => m.PublicApiComponent),
      },
      // Query param opcional: locationId.
      {
        path: 'public-menu/sold-out',
        loadComponent: () => import('src/app/modules/public-menu/pages/sold-out').then((m) => m.SoldOutComponent),
      },
      { path: 'payment-methods', component: PaymentMethodsComponent },
    ],
  },
];

export default routes;
