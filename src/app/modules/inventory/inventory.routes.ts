import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';
import { InventoryComponent } from './inventory.component';
import {
  AdjustmentListComponent,
  AdjustmentNewComponent,
  DocumentDetailComponent,
  IngredientsComponent,
  KardexComponent,
  PurchaseListComponent,
  PurchaseNewComponent,
  RecipeEditorComponent,
  RecipesComponent,
  StockComponent,
  UnitsComponent,
} from './pages';

const routes: Routes = [
  {
    path: '',
    component: InventoryComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', component: StockComponent, pathMatch: 'full' },
      { path: 'purchases', component: PurchaseListComponent, pathMatch: 'full' },
      // Query params opcionales: variationId (precarga una línea) y locationId.
      { path: 'purchases/new', component: PurchaseNewComponent },
      { path: 'adjustments', component: AdjustmentListComponent, pathMatch: 'full' },
      // Query params opcionales: variationId, reason (ej. initial_stock) y locationId.
      { path: 'adjustments/new', component: AdjustmentNewComponent },
      // Query params opcionales: variationId, productId, locationId, documentId.
      { path: 'kardex', component: KardexComponent },
      { path: 'documents/:id', component: DocumentDetailComponent },
      { path: 'ingredients', component: IngredientsComponent },
      // Query param opcional: tab=opciones (sets de modificadores).
      { path: 'recipes', component: RecipesComponent, pathMatch: 'full' },
      // productId de un plato o de un set de modificadores.
      { path: 'recipes/:productId', component: RecipeEditorComponent },
      { path: 'units', component: UnitsComponent },
    ],
  },
];

export default routes;
