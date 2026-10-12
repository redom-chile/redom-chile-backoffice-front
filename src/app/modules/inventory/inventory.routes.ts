import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';
import { InventoryComponent } from './inventory.component';
import { unsavedChangesGuard } from './shared/data-access';
import {
  AdjustmentListComponent,
  AdjustmentNewComponent,
  ConsumptionComponent,
  CountListComponent,
  CountNewComponent,
  DocumentDetailComponent,
  FoodCostComponent,
  LotsComponent,
  ProductionListComponent,
  ProductionNewComponent,
  PurchaseOrderDetailComponent,
  PurchaseOrderFormComponent,
  PurchaseOrderListComponent,
  IngredientsComponent,
  KardexComponent,
  PurchaseListComponent,
  PurchaseNewComponent,
  RecipeEditorComponent,
  RecipesComponent,
  StockComponent,
  TransferListComponent,
  TransferNewComponent,
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
      // Query params opcionales: status, locationId, supplierId, from, to, page.
      { path: 'purchase-orders', component: PurchaseOrderListComponent, pathMatch: 'full' },
      { path: 'purchase-orders/new', component: PurchaseOrderFormComponent, canDeactivate: [unsavedChangesGuard] },
      { path: 'purchase-orders/:id/edit', component: PurchaseOrderFormComponent, canDeactivate: [unsavedChangesGuard] },
      { path: 'purchase-orders/:id', component: PurchaseOrderDetailComponent },
      { path: 'adjustments', component: AdjustmentListComponent, pathMatch: 'full' },
      // Query params opcionales: variationId, reason (ej. initial_stock) y locationId.
      { path: 'adjustments/new', component: AdjustmentNewComponent },
      { path: 'counts', component: CountListComponent, pathMatch: 'full' },
      // Query param opcional: locationId.
      { path: 'counts/new', component: CountNewComponent, canDeactivate: [unsavedChangesGuard] },
      { path: 'transfers', component: TransferListComponent, pathMatch: 'full' },
      // Query params opcionales: fromLocationId y variationId.
      { path: 'transfers/new', component: TransferNewComponent },
      // Query params opcionales: variationId, productId, locationId, documentId.
      { path: 'kardex', component: KardexComponent },
      { path: 'documents/:id', component: DocumentDetailComponent },
      { path: 'ingredients', component: IngredientsComponent },
      // Query param opcional: tab=opciones (sets de modificadores).
      { path: 'recipes', component: RecipesComponent, pathMatch: 'full' },
      // productId de un plato o de un set de modificadores.
      { path: 'recipes/:productId', component: RecipeEditorComponent, canDeactivate: [unsavedChangesGuard] },
      { path: 'productions', component: ProductionListComponent, pathMatch: 'full' },
      // Query params opcionales: productId, variationId, locationId.
      { path: 'productions/new', component: ProductionNewComponent, canDeactivate: [unsavedChangesGuard] },
      // Query params opcionales: locationId, status, days, variationId.
      { path: 'lots', component: LotsComponent },
      // Query params opcionales: locationId, search, categoryId, avisos, orden.
      { path: 'food-cost', component: FoodCostComponent },
      // Query params opcionales: locationId, range, from, to, productId.
      { path: 'consumption', component: ConsumptionComponent },
      { path: 'units', component: UnitsComponent },
    ],
  },
];

export default routes;
