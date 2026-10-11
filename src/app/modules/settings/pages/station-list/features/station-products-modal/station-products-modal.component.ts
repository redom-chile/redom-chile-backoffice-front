import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ButtonComponent, IconComponent, ModalCardComponent, ProgressBarComponent, SlotDirective, ToastService } from 'src/ui';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { GetMenuProductsService } from 'src/app/modules/orders/pages/order-create/data-access';
import { getStationErrorMessage, StationDto, StationProductDto, StationProductsService } from '../../data-access';

@Component({
  selector: 'app-station-products-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, ProgressBarComponent, SlotDirective],
  templateUrl: './station-products-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StationProductsModalComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<StationProductsModalComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly stationProducts = inject(StationProductsService);
  private readonly menuService = inject(GetMenuProductsService);
  readonly #access = inject(AccessService);

  readonly $canAssign = computed(() => this.#access.can(PERMISSIONS.STATIONS.ASSIGN_PRODUCTS));

  readonly station = inject<StationDto>(MAT_DIALOG_DATA);
  readonly search = new FormControl('', { nonNullable: true });

  readonly $assigned = signal<StationProductDto[]>([]);
  readonly $isLoadingAssigned = signal(true);
  readonly $pendingIds = signal<ReadonlySet<number>>(new Set());
  readonly $catalog = this.menuService.$products;
  readonly $isSearching = computed(() => this.menuService.$isLoading() ?? false);
  readonly $assignedIds = computed(() => new Set(this.$assigned().map((product) => product.productId)));

  ngOnInit(): void {
    this.stationProducts.findAll(this.station.id).subscribe({
      next: (products) => {
        this.$assigned.set(products);
        this.$isLoadingAssigned.set(false);
      },
      error: () => {
        this.$isLoadingAssigned.set(false);
        this.toast.show('No se pudieron cargar los productos de la estación', 'error');
      },
    });

    // El catálogo solo se usa para asignar.
    if (!this.$canAssign()) return;
    this.menuService.load({ categoryId: null, name: '' });
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => this.menuService.load({ categoryId: null, name }));
  }

  toggle(product: { id: number; name: string; sku: string }) {
    if (!this.$canAssign() || this.$pendingIds().has(product.id)) return;
    this.setPending(product.id, true);
    const assigned = this.$assignedIds().has(product.id);
    const request = assigned
      ? this.stationProducts.remove(this.station.id, product.id)
      : this.stationProducts.assign(this.station.id, product.id);

    request.subscribe({
      next: () => {
        this.setPending(product.id, false);
        this.$assigned.update((list) =>
          assigned
            ? list.filter((item) => item.productId !== product.id)
            : [...list, { productId: product.id, productName: product.name, sku: product.sku }],
        );
      },
      error: (error: HttpErrorResponse) => {
        this.setPending(product.id, false);
        this.toast.show(getStationErrorMessage(error.status), 'error');
      },
    });
  }

  close() {
    this.dialogRef.close();
  }

  private setPending(id: number, pending: boolean) {
    this.$pendingIds.update((ids) => {
      const next = new Set(ids);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
