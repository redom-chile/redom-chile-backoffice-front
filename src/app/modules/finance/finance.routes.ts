import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';
import { unsavedChangesGuard } from 'src/app/modules/inventory/shared/data-access';
import {
  ExpenseCategoriesComponent,
  ExpenseDetailComponent,
  ExpenseFormComponent,
  ExpenseListComponent,
  PayablesComponent,
  PurchasePaymentsComponent,
  RecurringExpensesComponent,
  SettlementsComponent,
  TipPayoutDetailComponent,
  TipPayoutNewComponent,
  TipsComponent,
} from './pages';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'expenses', pathMatch: 'full' },
      // Query params opcionales: locationId, categoryId, supplierId, status, from, to, search, page.
      { path: 'expenses', component: ExpenseListComponent, pathMatch: 'full' },
      { path: 'expenses/new', component: ExpenseFormComponent, canDeactivate: [unsavedChangesGuard] },
      { path: 'expenses/:id/edit', component: ExpenseFormComponent, canDeactivate: [unsavedChangesGuard] },
      { path: 'expenses/:id', component: ExpenseDetailComponent },
      // Query params opcionales: due (week|overdue), type, supplierId, locationId.
      { path: 'payables', component: PayablesComponent },
      // Pagos de una compra de inventario (id = documento de compra).
      { path: 'purchases/:id', component: PurchasePaymentsComponent },
      // Query params opcionales: from, to, locationId, paidFrom, paidTo, cancelled, page.
      { path: 'tips', component: TipsComponent, pathMatch: 'full' },
      // Query params opcionales: from, to, locationId.
      { path: 'tips/new', component: TipPayoutNewComponent },
      { path: 'tips/payouts/:id', component: TipPayoutDetailComponent },
      // Query params opcionales: from, to, locationId, method.
      { path: 'settlements', component: SettlementsComponent },
      { path: 'recurring', component: RecurringExpensesComponent },
      { path: 'categories', component: ExpenseCategoriesComponent },
    ],
  },
];

export default routes;
