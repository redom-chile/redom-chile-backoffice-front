import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  ExpenseCategoryDto,
  ExpenseDto,
  ExpenseFiltersDto,
  ExpenseListItemDto,
  RecurringExpenseDto,
  SaveRecurringExpenseDto,
  UpdateExpenseCategoryDto,
  UpdateExpenseDto,
  UpdateRecurringExpenseDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/expenses`;

/** Gastos, sus categorías y los recurrentes. Los recurrentes se generan solos al listar gastos o cuentas por pagar. */
@Injectable({ providedIn: 'root' })
export class ExpensesService {
  readonly #http = inject(HttpClient);

  // La primera vez el backend crea las 8 categorías por defecto.
  getCategories(includeInactive = false): Observable<ExpenseCategoryDto[]> {
    return this.#http.get<ExpenseCategoryDto[]>(`${BASE}/categories`, { params: toHttpParams({ includeInactive }) });
  }

  createCategory(dto: CreateExpenseCategoryDto): Observable<{ id: number }> {
    return this.#http.post<{ id: number }>(`${BASE}/categories`, dto);
  }

  updateCategory(id: number, dto: UpdateExpenseCategoryDto): Observable<void> {
    return this.#http.put<void>(`${BASE}/categories/${id}`, dto);
  }

  list(filters: ExpenseFiltersDto): Observable<StandardizedPagination<ExpenseListItemDto>> {
    return this.#http.get<StandardizedPagination<ExpenseListItemDto>>(BASE, { params: toHttpParams(filters) });
  }

  get(id: number): Observable<ExpenseDto> {
    return this.#http.get<ExpenseDto>(`${BASE}/${id}`);
  }

  create(dto: CreateExpenseDto): Observable<ExpenseDto> {
    return this.#http.post<ExpenseDto>(BASE, dto);
  }

  update(id: number, dto: UpdateExpenseDto): Observable<ExpenseDto> {
    return this.#http.put<ExpenseDto>(`${BASE}/${id}`, dto);
  }

  /** 409 EXPENSE_HAS_PAYMENTS si tiene pagos: anularlos primero. */
  cancel(id: number, reason: string): Observable<void> {
    return this.#http.patch<void>(`${BASE}/${id}/cancel`, { reason });
  }

  getRecurring(filters: { locationId?: number; includeInactive?: boolean } = {}): Observable<RecurringExpenseDto[]> {
    return this.#http.get<RecurringExpenseDto[]>(`${BASE}/recurring`, { params: toHttpParams(filters) });
  }

  /** `generated`: gastos pendientes creados por ocurrencias pasadas. */
  createRecurring(dto: SaveRecurringExpenseDto): Observable<{ id: number; generated: number }> {
    return this.#http.post<{ id: number; generated: number }>(`${BASE}/recurring`, dto);
  }

  updateRecurring(id: number, dto: UpdateRecurringExpenseDto): Observable<void> {
    return this.#http.put<void>(`${BASE}/recurring/${id}`, dto);
  }
}
