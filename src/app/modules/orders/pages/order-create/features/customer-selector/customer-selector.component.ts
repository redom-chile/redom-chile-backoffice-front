import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent, ToastService } from 'src/ui';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { CreateCustomerService, CustomerDto, SearchCustomersService } from '../../data-access';

@Component({
  selector: 'app-customer-selector',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent, CheckPermissionDirective],
  templateUrl: './customer-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerSelectorComponent {
  private readonly toast = inject(ToastService);
  private readonly searchService = inject(SearchCustomersService);
  private readonly createService = inject(CreateCustomerService);

  protected readonly PERMISSIONS = PERMISSIONS;

  readonly selected = input<CustomerDto | null>(null);
  readonly selectedChange = output<CustomerDto | null>();

  readonly $results = this.searchService.$customers;
  readonly $isSearching = this.searchService.$isLoading;
  readonly $query = signal('');
  readonly $mode = signal<'search' | 'create'>('search');
  readonly $isCreating = signal(false);
  readonly $existing = signal<CustomerDto | null>(null);

  readonly createForm = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    mobile: ['', [Validators.required, Validators.pattern(/^\+?[\d\s-]{8,15}$/)]],
  });

  onSearch(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.$query.set(query);
    this.searchService.search(query);
  }

  select(customer: CustomerDto) {
    this.selectedChange.emit(customer);
    this.reset();
  }

  clear() {
    this.selectedChange.emit(null);
  }

  openCreate() {
    const query = this.$query().trim();
    const looksLikePhone = /^\+?[\d\s-]+$/.test(query);
    this.createForm.reset({ name: looksLikePhone ? '' : query, mobile: looksLikePhone ? query : '' });
    this.$existing.set(null);
    this.$mode.set('create');
  }

  create() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.toast.show('Ingresa nombre y un teléfono válido', 'warning');
      return;
    }
    this.$isCreating.set(true);
    this.createService.create(this.createForm.getRawValue()).subscribe({
      next: (customer) => {
        this.$isCreating.set(false);
        this.toast.show('Cliente creado', 'success');
        this.select(customer);
      },
      error: (error: HttpErrorResponse) => {
        this.$isCreating.set(false);
        const existing = this.createService.getExistingCustomer(error);
        if (existing) {
          const { name, mobile } = this.createForm.getRawValue();
          this.$existing.set({ id: existing.id, name: existing.name || name, mobile, email: null });
          this.toast.show('Ya existe un cliente con ese teléfono', 'warning');
          return;
        }
        this.toast.show('No se pudo crear el cliente', 'error');
      },
    });
  }

  cancelCreate() {
    this.$mode.set('search');
    this.$existing.set(null);
  }

  private reset() {
    this.$query.set('');
    this.searchService.search('');
    this.$mode.set('search');
    this.$existing.set(null);
  }
}
