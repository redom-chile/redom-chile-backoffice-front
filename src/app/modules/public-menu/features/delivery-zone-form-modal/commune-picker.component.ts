import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { GetCommunesDto } from 'src/app/core/services/address/dtos/get-communes.dto';
import { GetProvincesDto, GetRegionsDto } from 'src/app/core/services/address/dtos';
import { CommuneRefDto } from 'src/app/modules/public-menu/data-access';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { ApiPathEnum } from 'src/environments';
import { IconComponent } from 'src/ui';

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Comunas elegidas (chips) y selector región → provincia → comunas, con búsqueda. */
@Component({
  selector: 'app-commune-picker',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      @if (selected().length) {
      <ul class="flex flex-wrap gap-1.5" aria-label="Comunas elegidas">
        @for (commune of selected(); track commune.id) {
        <li class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-medium">
          {{ commune.name }}
          <button type="button" class="hover:bg-primary/20 inline-flex h-5 w-5 items-center justify-center rounded-full" [attr.aria-label]="'Quitar ' + commune.name" (click)="remove(commune.id)">
            <app-icon class="h-3.5 w-3.5">close</app-icon>
          </button>
        </li>
        }
      </ul>
      }

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select class="glass-input w-full rounded-md px-3 py-2 text-sm" aria-label="Región" (change)="selectRegion($event)">
          <option value="" [selected]="!$regionId()">Región</option>
          @for (region of $regions(); track region.id) {
          <option [value]="region.id" [selected]="region.id === $regionId()">{{ region.name }}</option>
          }
        </select>
        <select class="glass-input w-full rounded-md px-3 py-2 text-sm" aria-label="Provincia" [disabled]="!$regionId()" (change)="selectProvince($event)">
          <option value="" [selected]="!$provinceId()">Provincia</option>
          @for (province of $provinces(); track province.id) {
          <option [value]="province.id" [selected]="province.id === $provinceId()">{{ province.name }}</option>
          }
        </select>
      </div>
      @if ($loadError()) {
      <p class="text-xs text-red-600 dark:text-red-400">No se pudieron cargar las comunas.</p>
      }

      @if ($provinceId()) {
      <div class="glass-row flex flex-col gap-2 rounded-xl p-2">
        <div class="flex items-center gap-2">
          <input
            type="search"
            class="glass-input min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm"
            placeholder="Buscar comuna"
            aria-label="Buscar comuna"
            [value]="$search()"
            (input)="$search.set($any($event.target).value)" />
          <button type="button" class="text-primary shrink-0 text-xs font-semibold hover:underline" (click)="addAll()">Agregar todas</button>
        </div>
        @if (communes.isLoading()) {
        <p class="text-muted-foreground px-1 text-xs">Cargando…</p>
        } @else {
        <div class="grid max-h-48 grid-cols-1 gap-0.5 overflow-y-auto sm:grid-cols-2">
          @for (commune of $filtered(); track commune.id) {
          <label class="hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm">
            <input type="checkbox" class="accent-primary h-4 w-4" [checked]="$selectedIds().has(commune.id)" (change)="toggle(commune, $any($event.target).checked)" />
            <span class="text-foreground">{{ commune.name }}</span>
          </label>
          } @empty {
          <p class="text-muted-foreground px-1 text-xs">Sin resultados.</p>
          }
        </div>
        }
      </div>
      }
    </div>
  `,
})
export class CommunePickerComponent {
  readonly #http = inject(HttpClient);

  readonly selected = model<CommuneRefDto[]>([]);

  readonly $regionId = signal<number | null>(null);
  readonly $provinceId = signal<number | null>(null);
  readonly $search = signal('');

  readonly #regions = rxResource({
    stream: () => this.#http.get<GetRegionsDto[]>(`${ApiPathEnum.AUTH}/address/regions`).pipe(toRemoteResult()),
  });
  readonly #provinces = rxResource({
    params: () => this.$regionId() ?? undefined,
    stream: ({ params }) => this.#http.get<GetProvincesDto[]>(`${ApiPathEnum.AUTH}/address/provinces/${params}`).pipe(toRemoteResult()),
  });
  readonly communes = rxResource({
    params: () => this.$provinceId() ?? undefined,
    stream: ({ params }) => this.#http.get<GetCommunesDto[]>(`${ApiPathEnum.AUTH}/address/comunes/${params}`).pipe(toRemoteResult()),
  });

  readonly $regions = computed(() => resultValue(this.#regions.value()) ?? []);
  readonly $provinces = computed(() => resultValue(this.#provinces.value()) ?? []);
  readonly $loadError = computed(
    () => !!(resultError(this.#regions.value()) || resultError(this.#provinces.value()) || resultError(this.communes.value())),
  );
  readonly $selectedIds = computed(() => new Set(this.selected().map((commune) => commune.id)));
  readonly $filtered = computed(() => {
    const list = resultValue(this.communes.value()) ?? [];
    const search = normalize(this.$search().trim());
    return search ? list.filter((commune) => normalize(commune.name).includes(search)) : list;
  });

  selectRegion(event: Event) {
    this.$regionId.set(Number((event.target as HTMLSelectElement).value) || null);
    this.$provinceId.set(null);
    this.$search.set('');
  }

  selectProvince(event: Event) {
    this.$provinceId.set(Number((event.target as HTMLSelectElement).value) || null);
    this.$search.set('');
  }

  toggle(commune: GetCommunesDto, checked: boolean) {
    if (checked) this.#add([commune]);
    else this.remove(commune.id);
  }

  addAll() {
    this.#add(this.$filtered());
  }

  remove(id: number) {
    this.selected.update((list) => list.filter((commune) => commune.id !== id));
  }

  #add(communes: readonly GetCommunesDto[]) {
    const ids = this.$selectedIds();
    const fresh = communes.filter((commune) => !ids.has(commune.id)).map(({ id, name }) => ({ id, name }));
    if (fresh.length) this.selected.update((list) => [...list, ...fresh]);
  }
}
