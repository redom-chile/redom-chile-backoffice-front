import { Routes } from '@angular/router';
import { LayoutComponent } from './layout.component';

const routes: Routes = [
  {
    path: 'dashboard',
    component: LayoutComponent,
    loadChildren: () => import('../dashboard/dashboard.routes'),
  },
  {
    path: 'components/table',
    component: LayoutComponent,
    loadChildren: () => import('../uim/uim.routes'),
  },
  {
    path: 'components',
    component: LayoutComponent,
    loadChildren: () => import('../uikit/uikit.routes'),
  },
  {
    path: 'roles-and-permissions',
    component: LayoutComponent,
    loadChildren: () => import('../roles-and-permissions/roles-and-permissions.routes'),
  },
  {
    path: 'business',
    component: LayoutComponent,
    loadChildren: () => import('../restaurante/restaurante.routes'),
  },
  {
    path: 'pos',
    component: LayoutComponent,
    loadChildren: () => import('../pos/pos.routes'),
  },
  {
    path: 'kitchen',
    component: LayoutComponent,
    loadChildren: () => import('../kitchen/kitchen.routes'),
  },
  {
    path: 'orders',
    component: LayoutComponent,
    loadChildren: () => import('../orders/orders.routes'),
  },
  {
    path: 'tables',
    component: LayoutComponent,
    loadChildren: () => import('../tables/tables.routes'),
  },
  {
    path: 'sectors',
    component: LayoutComponent,
    loadChildren: () => import('../sectors/sectors.routes'),
  },
  {
    path: 'payments',
    component: LayoutComponent,
    loadChildren: () => import('../payments/payments.routes'),
  },
  {
    path: 'cash',
    component: LayoutComponent,
    loadChildren: () => import('../cash/cash.routes'),
  },
  {
    path: 'help',
    component: LayoutComponent,
    loadChildren: () => import('../help/help.routes'),
  },
  {
    path: 'finance',
    component: LayoutComponent,
    loadChildren: () => import('../finance/finance.routes'),
  },
  {
    path: 'products',
    component: LayoutComponent,
    loadChildren: () => import('../products/products.routes'),
  },
  {
    path: 'inventory',
    component: LayoutComponent,
    loadChildren: () => import('../inventory/inventory.routes'),
  },
  {
    path: 'customers',
    component: LayoutComponent,
    loadChildren: () => import('../customers/customers.routes'),
  },
  {
    path: 'bookings',
    component: LayoutComponent,
    loadChildren: () => import('../bookings/bookings.routes'),
  },
  {
    path: 'settings',
    component: LayoutComponent,
    loadChildren: () => import('../settings/settings.routes'),
  },
  {
    path: 'profile',
    component: LayoutComponent,
    loadChildren: () => import('../profile/profile.routes'),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'error/404' },
];

export default routes;
