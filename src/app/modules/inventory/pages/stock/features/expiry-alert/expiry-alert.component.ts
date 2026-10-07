import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { InventoryService, StockLotDto } from '../../../../data-access';
import { EXPIRY_DAYS_OPTIONS, readExpiryDays, resultValue, saveExpiryDays, toRemoteResult } from '../../../../shared';

type ExpiryCounts = Readonly<{ expiring: number; expired: number }>;

// Ítems distintos: un ítem puede tener varios lotes.
function countItems(lots: readonly StockLotDto[]): number {
  return new Set(lots.map((lot) => `${lot.locationId}:${lot.variationId}`)).size;
}

/**
 * Alerta de lotes por vencer y vencidos. "pill" para el encabezado del stock (con los días configurables,
 * recordados en el navegador) y "card" para el dashboard (todos los locales). Lleva a Lotes con los filtros.
 * Si falla la carga no se muestra: es solo un aviso.
 */
@Component({
  selector: 'app-expiry-alert',
  imports: [RouterLink, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let counts = $counts();
    @if (variant() === 'card') {
    @if (counts || data.isLoading()) {
    <div class="glass-tile-soft flex h-full w-full flex-col gap-2 rounded-2xl p-4 text-left">
      <div class="flex items-center justify-between gap-2">
        <p class="text-muted-foreground text-sm">Por vencer / Vencidos</p>
        <span class="flex h-9 w-9 items-center justify-center rounded-lg" [class]="$tone()">
          <app-icon class="h-5 w-5">event_busy</app-icon>
        </span>
      </div>
      @if (data.isLoading() || !counts) {
      <app-skeleton size="xs" style="width: 80px" />
      } @else {
      <p class="text-2xl font-bold tabular-nums">
        <span [class]="counts.expiring ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'">{{ counts.expiring }}</span>
        <span class="text-muted-foreground px-1 text-lg font-normal">/</span>
        <span [class]="counts.expired ? 'text-red-600' : 'text-foreground'">{{ counts.expired }}</span>
      </p>
      }
      <p class="text-muted-foreground text-xs">Ítems con lotes que vencen en {{ $days() }} días / ya vencidos · todos los locales</p>
      <div class="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
        <a routerLink="/inventory/lots" [queryParams]="expiringParams()" class="text-primary hover:underline">Ver por vencer</a>
        <a routerLink="/inventory/lots" [queryParams]="expiredParams()" class="text-primary hover:underline">Ver vencidos</a>
      </div>
    </div>
    }
    } @else {
    @if (data.isLoading()) {
    <app-skeleton size="xs" style="width: 160px" />
    } @else if (counts) {
    <div class="flex flex-wrap items-center gap-2">
      @if (counts.expired) {
      <a
        routerLink="/inventory/lots"
        [queryParams]="expiredParams()"
        title="Ver los lotes vencidos. Las salidas consumen primero lo vencido (FEFO)."
        class="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-500/25 dark:text-red-400">
        <app-icon class="h-4 w-4">event_busy</app-icon>
        {{ counts.expired }} {{ counts.expired === 1 ? 'ítem vencido' : 'ítems vencidos' }}
      </a>
      }
      @if (counts.expiring) {
      <a
        routerLink="/inventory/lots"
        [queryParams]="expiringParams()"
        class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-500/25 dark:text-amber-400">
        <app-icon class="h-4 w-4">schedule</app-icon>
        {{ counts.expiring }} por vencer
      </a>
      } @else if (!counts.expired) {
      <span class="text-muted-foreground inline-flex items-center gap-1.5 px-1 py-1.5 text-sm">
        <app-icon class="h-4 w-4 text-green-600">event_available</app-icon>
        Nada por vencer
      </span>
      }
      <label class="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <span class="sr-only">Días para "por vencer"</span>
        en
        <select class="glass-input rounded-md px-2 py-1 text-xs" [value]="$days()" (change)="onDays($event)">
          @for (option of daysOptions; track option) {
          <option [value]="option" [selected]="option === $days()">{{ option }} días</option>
          }
        </select>
      </label>
    </div>
    }
    }
  `,
})
export class ExpiryAlertComponent {
  readonly #inventory = inject(InventoryService);

  /** Local a revisar; con allLocations se ignora y se revisan todos. */
  readonly locationId = input<number | null>(null);
  readonly allLocations = input(false);
  readonly variant = input<'pill' | 'card'>('pill');

  protected readonly daysOptions = EXPIRY_DAYS_OPTIONS;
  readonly $days = signal(readExpiryDays());

  readonly data = rxResource({
    params: () => {
      const locationId = this.allLocations() ? undefined : (this.locationId() ?? null);
      if (locationId === null) return undefined;
      return { locationId, days: this.$days() };
    },
    stream: ({ params }) =>
      forkJoin({
        expiring: this.#inventory.getLots({ locationId: params.locationId, status: 'expiring', days: params.days }),
        expired: this.#inventory.getLots({ locationId: params.locationId, status: 'expired' }),
      }).pipe(
        map((lots): ExpiryCounts => ({ expiring: countItems(lots.expiring), expired: countItems(lots.expired) })),
        toRemoteResult(),
      ),
  });

  readonly $counts = computed(() => resultValue(this.data.value()));
  readonly $tone = computed(() => {
    const counts = this.$counts();
    if (counts?.expired) return 'bg-red-500/15 text-red-600';
    if (counts?.expiring) return 'bg-amber-500/15 text-amber-600';
    return 'bg-primary/10 text-primary';
  });

  onDays(event: Event) {
    const days = Number((event.target as HTMLSelectElement).value);
    this.$days.set(days);
    saveExpiryDays(days);
  }

  expiringParams() {
    return { status: 'expiring', days: this.$days(), ...this.#locationParam() };
  }

  expiredParams() {
    return { status: 'expired', ...this.#locationParam() };
  }

  reload() {
    this.data.reload();
  }

  #locationParam(): { locationId?: number } {
    const locationId = this.locationId();
    return !this.allLocations() && locationId ? { locationId } : {};
  }
}
