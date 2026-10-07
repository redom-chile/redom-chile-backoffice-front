import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { CreateSupplierDto, SupplierDto } from './dtos';
import { toHttpParams } from './inventory.service';

const BASE = `${ApiPathEnum.RESTAURANT}/contacts`;

/** Proveedores = contactos de tipo "supplier". */
@Injectable({ providedIn: 'root' })
export class SuppliersService {
  readonly #http = inject(HttpClient);

  getAll(page = 1, perPage = 100): Observable<StandardizedPagination<SupplierDto>> {
    return this.#http.get<StandardizedPagination<SupplierDto>>(BASE, {
      params: toHttpParams({ type: 'supplier', page, perPage }),
    });
  }

  create(dto: Omit<CreateSupplierDto, 'type'>): Observable<{ id: number }> {
    return this.#http.post<{ id: number }>(BASE, { ...dto, type: 'supplier' });
  }
}

export function supplierLabel(supplier: SupplierDto): string {
  return supplier.supplierBusinessName || supplier.name || `Proveedor #${supplier.id}`;
}
