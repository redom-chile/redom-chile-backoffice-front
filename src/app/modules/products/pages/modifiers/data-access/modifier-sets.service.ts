import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import {
  CreateModifierSetDto,
  ModifierSetDto,
  ProductModifiersDto,
  UpdateModifierSetDto,
  UpdateProductModifiersDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/modifier-sets`;
const PRODUCT_MODIFIERS = `${ApiPathEnum.RESTAURANT}/product-modifiers`;

/** Sets de modificadores del negocio (GET /modifier-sets devuelve un arreglo, sin paginar). */
@Injectable({ providedIn: 'root' })
export class ModifierSetsService {
  readonly #http = inject(HttpClient);
  readonly #sets = signal<ModifierSetDto[] | null>(null);
  readonly #isLoading = signal(false);
  readonly #error = signal<unknown>(null);

  readonly $sets = this.#sets.asReadonly();
  readonly $isLoading = this.#isLoading.asReadonly();
  readonly $error = this.#error.asReadonly();

  load() {
    this.#isLoading.set(true);
    this.#error.set(null);
    this.#http.get<ModifierSetDto[]>(BASE).subscribe({
      next: (sets) => {
        this.#sets.set([...sets]);
        this.#isLoading.set(false);
      },
      error: (error) => {
        this.#error.set(error);
        this.#isLoading.set(false);
      },
    });
  }

  create(dto: CreateModifierSetDto): Observable<unknown> {
    return this.#http.post(BASE, dto).pipe(tap(() => this.load()));
  }

  // El backend exige el id también en el body.
  update(dto: UpdateModifierSetDto): Observable<unknown> {
    return this.#http.put(`${BASE}/${dto.id}`, dto).pipe(tap(() => this.load()));
  }

  delete(id: number): Observable<unknown> {
    return this.#http.delete(`${BASE}/${id}`).pipe(tap(() => this.load()));
  }

  findLinkedProducts(setId: number): Observable<ProductModifiersDto> {
    return this.#http.get<ProductModifiersDto>(`${PRODUCT_MODIFIERS}/${setId}`);
  }

  updateLinkedProducts(dto: UpdateProductModifiersDto): Observable<unknown> {
    return this.#http.put(`${PRODUCT_MODIFIERS}/${dto.id}`, dto).pipe(tap(() => this.load()));
  }
}
