import { Routes } from '@angular/router';
import { unsavedChangesGuard } from 'src/app/modules/inventory/shared/data-access';

export default [
  // Query param opcional: tab (automations|campaigns).
  {
    path: '',
    loadComponent: () => import('./pages/messaging').then((m) => m.MessagingComponent),
  },
  // id numérico o "new".
  {
    path: 'campaigns/:id',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./pages/campaign-editor').then((m) => m.CampaignEditorComponent),
  },
] satisfies Routes;
