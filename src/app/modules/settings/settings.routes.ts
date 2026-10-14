import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';
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
