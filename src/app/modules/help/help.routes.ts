import { Routes } from '@angular/router';
import { authGuard, roleGuard } from 'src/app/core';
import { unsavedChangesGuard } from 'src/app/modules/inventory/shared/data-access';
import { HELP_ADMIN_ROLE } from './data-access';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      // Administración del contenido (solo el equipo de Redom). Va antes de :slug.
      {
        path: 'admin',
        canActivateChild: [roleGuard],
        data: { roles: [HELP_ADMIN_ROLE] },
        children: [
          { path: '', redirectTo: 'articles', pathMatch: 'full' },
          // Query params opcionales: search, categoryId, module, status, page.
          {
            path: 'articles',
            pathMatch: 'full',
            loadComponent: () => import('./pages/admin-articles/admin-articles.component').then((m) => m.AdminArticlesComponent),
          },
          // Query params opcionales: title (pregunta del asistente sin artículo), categoryId.
          {
            path: 'articles/new',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () => import('./pages/admin-article-form/admin-article-form.component').then((m) => m.AdminArticleFormComponent),
          },
          {
            path: 'articles/:id/edit',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () => import('./pages/admin-article-form/admin-article-form.component').then((m) => m.AdminArticleFormComponent),
          },
          {
            path: 'categories',
            loadComponent: () => import('./pages/admin-categories/admin-categories.component').then((m) => m.AdminCategoriesComponent),
          },
          // Query params opcionales: helpful, withoutArticles, from, to, businessId, page.
          {
            path: 'review',
            loadComponent: () => import('./pages/admin-review/admin-review.component').then((m) => m.AdminReviewComponent),
          },
          // Query params opcionales: from, to.
          {
            path: 'usage',
            loadComponent: () => import('./pages/admin-usage/admin-usage.component').then((m) => m.AdminUsageComponent),
          },
        ],
      },
      // Query params opcionales: search, categoryId, page.
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/help-home/help-home.component').then((m) => m.HelpHomeComponent),
      },
      {
        path: ':slug',
        loadComponent: () => import('./pages/help-article/help-article.component').then((m) => m.HelpArticleComponent),
      },
    ],
  },
];

export default routes;
