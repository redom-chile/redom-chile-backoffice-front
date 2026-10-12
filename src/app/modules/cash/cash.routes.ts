import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';
import { CashSessionDetailComponent, CashSessionListComponent } from './pages';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', component: CashSessionListComponent, pathMatch: 'full' },
      { path: 'sessions/:id', component: CashSessionDetailComponent },
    ],
  },
];

export default routes;
