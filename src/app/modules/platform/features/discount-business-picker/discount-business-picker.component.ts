import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, model, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { PlatformService } from '../../data-access';

export type PickedBusiness = Readonly<{ id: number; name: string }>;

/** Elige negocios buscándolos por nombre, RUT o dueño; los elegidos se muestran como chips. */
@Component({
  selector: 'app-discount-business-picker',
  imports: [IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value().length) {
    <div class="mb-2 flex flex-wrap gap-1.5">
      @for (business of value(); track business.id) {
      <span class="bg-primary/10 text-foreground inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-medium">
        <span class="truncate">{{ business.name }}</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
          [disabled]="disabled()"
          [attr.aria-label]="'Quitar ' + business.name"
          (click)="remove(business.id)">
          <app-icon class="h-4 w-4">close</app-icon>
        </button>
      </span>
      }
    </div>
    }

    <div class="relative">
      <app-icon class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" aria-hidden="true">search</app-icon>
      <input
        type="search"
        class="glass-input w-full rounded-md py-2 pl-10 pr-3"
        placeholder="Busca por nombre, RUT o dueño"
        autocomplete="off"
        [id]="inputId()"
        [disabled]="disabled()"
        [value]="$draft()"
        (input)="handleInput($event)"
        (keydown.enter)="$event.preventDefault()" />
    </div>

    @if ($term()) {
    <div class="mt-1 max-h-56 overflow-y-auto rounded-md border border-[var(--border)]">
      @if (results.isLoading()) {
      <div class="space-y-2 p-3">
        <app-skeleton size="xs" style="width: 60%" />
        <app-skeleton size="xs" style="width: 40%" />
      </div>
      } @else if ($error()) {
      <p class="text-destructive p-3 text-sm">No se pudo buscar. Intenta de nuevo.</p>
      } @else if (!$results().length) {
      <p class="text-muted-foreground p-3 text-sm">No hay negocios con "{{ $term() }}".</p>
      } @else {
      <ul class="divide-y divide-[var(--border)]">
        @for (business of $results(); track business.id) {
        @let picked = isPicked(business.id);
        <li>
          <button
            type="button"
            class="glass-row flex w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
            [disabled]="picked"
            (click)="add({ id: business.id, name: business.name })">
            <span class="min-w-0 flex-1">
              <span class="text-foreground block truncate text-sm font-medium">{{ business.name }}</span>
              <span class="text-muted-foreground block truncate text-xs">
                {{ business.taxNumber ?? 'Sin RUT' }}@if (business.owner?.email) { · {{ business.owner!.email }} }
              </span>
            </span>
            <app-icon class="h-5 w-5 shrink-0" [class.text-primary]="!picked" [class.text-muted-foreground]="picked">{{ picked ? 'check' : 'add' }}</app-icon>
          </button>
        </li>
        }
      </ul>
      }
    </div>
    }
  `,
})
export class DiscountBusinessPickerComponent {
  readonly #platform = inject(PlatformService);
  readonly #destroyRef = inject(DestroyRef);

  readonly value = model<PickedBusiness[]>([]);
  readonly inputId = input('');
  readonly disabled = input(false);

  readonly $draft = signal('');
  readonly $term = signal('');
  readonly #draft$ = new Subject<string>();

  readonly results = rxResource({
    params: () => this.$term() || undefined,
    stream: ({ params }) => this.#platform.getBusinesses({ search: params, perPage: 20 }).pipe(toRemoteResult()),
  });
  readonly $results = computed(() => resultValue(this.results.value())?.data ?? []);
  readonly $error = computed(() => resultError(this.results.value()));

  constructor() {
    this.#draft$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((term) => this.$term.set(term));
  }

  handleInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$draft.set(value);
    this.#draft$.next(value.trim());
  }

  isPicked(id: number): boolean {
    return this.value().some((business) => business.id === id);
  }

  add(business: PickedBusiness) {
    if (this.isPicked(business.id)) return;
    this.value.update((list) => [...list, business]);
  }

  remove(id: number) {
    this.value.update((list) => list.filter((business) => business.id !== id));
  }
}
