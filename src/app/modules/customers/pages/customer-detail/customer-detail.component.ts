import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { formatCurrency, formatDateTime, ORDER_STATUS, StatusBadgeComponent } from 'src/app/modules/orders/pages/order-list/ui';
import { CustomerDetailDto, CustomerService } from './data-access';
import { UpdateCustomerModalComponent } from './features';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [RouterLink, MatTooltipModule, ButtonComponent, IconComponent, SkeletonComponent, StatusBadgeComponent, CheckPermissionDirective],
  templateUrl: './customer-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly customerService = inject(CustomerService);

  protected readonly PERMISSIONS = PERMISSIONS;

  readonly orderStatus = ORDER_STATUS;
  readonly formatCurrency = formatCurrency;
  readonly formatDateTime = formatDateTime;

  readonly $customer = signal<CustomerDetailDto | null>(null);
  readonly $isLoading = signal(true);
  readonly $error = signal<number | null>(null);
  readonly $orders = computed(() =>
    [...(this.$customer()?.recentOrders ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  ngOnInit(): void {
    this.load();
  }

  load() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.$isLoading.set(false);
      this.$error.set(HttpStatusCode.NotFound);
      return;
    }
    this.$isLoading.set(true);
    this.$error.set(null);
    this.customerService.findById(id).subscribe({
      next: (customer) => {
        this.$customer.set(customer);
        this.$isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.$error.set(error.status);
        this.$isLoading.set(false);
      },
    });
  }

  handleEdit(customer: CustomerDetailDto) {
    this.dialog
      .open<UpdateCustomerModalComponent, CustomerDetailDto, boolean>(UpdateCustomerModalComponent, {
        width: '600px',
        maxWidth: '95vw',
        disableClose: true,
        data: customer,
      })
      .afterClosed()
      .subscribe((updated) => {
        if (!updated) return;
        this.toast.show('Cliente actualizado', 'success');
        this.load();
      });
  }

  handleDelete(customer: CustomerDetailDto) {
    this.dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar cliente',
          message: `¿Eliminar a ${customer.name}? Sus pedidos anteriores se conservan, pero ya no podrás elegirlo en el POS ni en reservas.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.customerService.delete(customer.id).subscribe({
          next: () => {
            this.toast.show('Cliente eliminado', 'success');
            this.router.navigate(['/customers']);
          },
          error: () => this.toast.show('No se pudo eliminar el cliente', 'error'),
        });
      });
  }

  sinceLabel(date: string): string {
    return new Date(date).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  }
}
