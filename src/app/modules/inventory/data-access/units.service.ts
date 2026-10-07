import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { CreateUnitDto, UnitDto } from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/units`;

/** Unidades del negocio (GET /units devuelve un arreglo, sin paginar). Cachea la lista en $units. */
@Injectable({ providedIn: 'root' })
export class UnitsService {
  readonly #http = inject(HttpClient);
  readonly #units = signal<UnitDto[] | null>(null);
  readonly #isLoading = signal(false);
  readonly #hasError = signal(false);

  readonly $units = this.#units.asReadonly();
  readonly $isLoading = this.#isLoading.asReadonly();
  readonly $hasError = this.#hasError.asReadonly();

  /** Carga la lista (si ya está cargada, solo si force). */
  load(force = false) {
    if (this.#units() && !force) return;
    this.#isLoading.set(true);
    this.#hasError.set(false);
    this.#http.get<UnitDto[]>(BASE).subscribe({
      next: (units) => {
        this.#units.set([...units]);
        this.#isLoading.set(false);
      },
      error: () => {
        this.#hasError.set(true);
        this.#isLoading.set(false);
      },
    });
  }

  create(dto: CreateUnitDto): Observable<{ id: number }> {
    return this.#http.post<{ id: number }>(BASE, dto).pipe(tap(() => this.load(true)));
  }

  // El backend toma el id del body (la ruta es /units/:id).
  update(id: number, dto: Partial<CreateUnitDto>): Observable<unknown> {
    return this.#http.put(`${BASE}/${id}`, { id, ...dto }).pipe(tap(() => this.load(true)));
  }

  delete(id: number): Observable<unknown> {
    return this.#http.delete(`${BASE}/${id}`, { body: { id } }).pipe(tap(() => this.load(true)));
  }
}

/** Unidades válidas para un producto: su unidad base y las subunidades de esa unidad. */
export function unitsForProduct(units: readonly UnitDto[], productUnitId: number | null): UnitDto[] {
  if (!productUnitId) return [];
  return units.filter((unit) => unit.id === productUnitId || unit.baseUnitId === productUnitId);
}

/** Factor a la unidad base (1 para la unidad base). */
export function unitMultiplier(unit: UnitDto | undefined | null): number {
  const multiplier = Number(unit?.baseUnitMultiplier);
  return unit?.baseUnitId && Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

export function unitLabel(unit: UnitDto): string {
  return `${unit.actualName} (${unit.shortName})`;
}
