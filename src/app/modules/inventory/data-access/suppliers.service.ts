import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { CreateSupplierDto, SupplierDto, SupplierPayTermType, UpdateSupplierDto } from './dtos';
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

  update(id: number, dto: UpdateSupplierDto): Observable<unknown> {
    return this.#http.put(`${BASE}/${id}`, dto);
  }
}

export function supplierLabel(supplier: SupplierDto): string {
  return supplier.supplierBusinessName || supplier.name || `Proveedor #${supplier.id}`;
}

/** "30 días" · "1 mes" · "Contado". */
export function supplierPayTermLabel(supplier: Pick<SupplierDto, 'payTermNumber' | 'payTermType'>): string {
  const number = Number(supplier.payTermNumber ?? 0);
  if (!number || number <= 0) return 'Contado';
  if (supplier.payTermType === 'months') return `${number} ${number === 1 ? 'mes' : 'meses'}`;
  return `${number} ${number === 1 ? 'día' : 'días'}`;
}

/** Vencimiento por defecto (YYYY-MM-DD): fecha + condiciones del proveedor (contado = la misma fecha). */
export function supplierDueDate(
  documentDate: string,
  supplier: Pick<SupplierDto, 'payTermNumber' | 'payTermType'> | null | undefined,
): string {
  const number = Number(supplier?.payTermNumber ?? 0);
  const [year, month, day] = documentDate.split('-').map(Number);
  if (!year || !month || !day || !number || number <= 0) return documentDate;
  const date = new Date(year, month - 1, day);
  if ((supplier?.payTermType as SupplierPayTermType) === 'months') {
    date.setMonth(date.getMonth() + number);
    // 31-01 + 1 mes = último día de febrero (no 03-03).
    if (date.getDate() !== day) date.setDate(0);
  } else {
    date.setDate(date.getDate() + number);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
