import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { PlanUpsellService } from 'src/app/core/services/entitlements';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { IconComponent } from 'src/ui';
import { PackOptionDto, PackOptionsService } from '../../data-access';
import { PackContent } from './pack-content';
import {
  emptyPackGroup,
  isIncludedGroup,
  PACK_GROUP_NAME_MAX,
  PACK_MAX_GROUPS,
  PACK_MAX_ITEMS,
  PackEditorGroup,
  PackEditorItem,
} from './pack-editor';

type SearchState = Readonly<{ loading: boolean; error: boolean; options: PackOptionDto[] }>;

/** "Contenido del pack": grupos reordenables con sus opciones (el cliente elige entre X y Y). */
@Component({
  selector: 'app-product-pack-editor',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, IconComponent],
  templateUrl: './product-pack-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPackEditorComponent {
  readonly #options = inject(PackOptionsService);
  readonly #upsell = inject(PlanUpsellService);

  readonly content = input.required<PackContent>();
  // El mismo pack no puede ser una de sus opciones (null al crear).
  readonly productId = input<number | null>(null);

  readonly maxGroups = PACK_MAX_GROUPS;
  readonly maxItems = PACK_MAX_ITEMS;
  readonly nameMax = PACK_GROUP_NAME_MAX;
  readonly isIncluded = isIncludedGroup;
  readonly formatPrice = (value: number | null) => (value === null ? '—' : formatCurrency(Number(value)));

  readonly $readonly = computed(() => !this.content().canEdit);
  readonly $groups = computed(() => this.content().$groups());

  // Buscador abierto en un grupo a la vez.
  readonly $pickerKey = signal<number | null>(null);
  readonly $term = signal('');
  readonly #query = computed(() => ({ key: this.$pickerKey(), term: this.$term() }));
  readonly $search = toSignal(
    toObservable(this.#query).pipe(
      debounceTime(250),
      switchMap(({ key, term }) =>
        key === null
          ? of<SearchState>({ loading: false, error: false, options: [] })
          : this.#options.search(term, this.productId()).pipe(
              map((options): SearchState => ({ loading: false, error: false, options })),
              catchError(() => of<SearchState>({ loading: false, error: true, options: [] })),
              startWith<SearchState>({ loading: true, error: false, options: [] }),
            ),
      ),
    ),
    { initialValue: { loading: false, error: false, options: [] } as SearchState },
  );

  readonly inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';
  readonly smallInputClass =
    'w-20 rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

  showPlans() {
    this.#upsell.open({ features: ['menu_marketing'] });
  }

  retryLoad() {
    const id = this.productId();
    if (id) this.content().load(id);
  }

  addGroup() {
    if (this.$groups().length >= PACK_MAX_GROUPS) return;
    const group = emptyPackGroup();
    this.#set([...this.$groups(), group]);
    this.openPicker(group.key);
  }

  removeGroup(key: number) {
    this.#set(this.$groups().filter((group) => group.key !== key));
    if (this.$pickerKey() === key) this.closePicker();
  }

  drop(event: CdkDragDrop<unknown>) {
    const groups = [...this.$groups()];
    moveItemInArray(groups, event.previousIndex, event.currentIndex);
    this.#set(groups);
  }

  setName(key: number, name: string) {
    this.#patchGroup(key, { name });
  }

  setChoices(key: number, field: 'minChoices' | 'maxChoices', value: number) {
    this.#patchGroup(key, { [field]: value });
  }

  setItem(key: number, variationId: number, patch: Partial<PackEditorItem>) {
    const group = this.#group(key);
    if (!group) return;
    this.#patchGroup(key, {
      items: group.items.map((item) => (item.variationId === variationId ? { ...item, ...patch } : item)),
    });
  }

  removeItem(key: number, variationId: number) {
    const group = this.#group(key);
    if (!group) return;
    const items = group.items.filter((item) => item.variationId !== variationId);
    // Sin opciones suficientes, el mínimo baja para no quedar inválido.
    this.#patchGroup(key, { items, minChoices: Math.min(group.minChoices, Math.max(items.length, 0)) });
  }

  isInGroup(group: PackEditorGroup, variationId: number): boolean {
    return group.items.some((item) => item.variationId === variationId);
  }

  addItem(key: number, option: PackOptionDto) {
    const group = this.#group(key);
    if (!group || this.isInGroup(group, option.variationId) || group.items.length >= PACK_MAX_ITEMS) return;
    const item: PackEditorItem = {
      variationId: option.variationId,
      name: option.name,
      price: option.price,
      quantity: 1,
      extraPrice: 0,
      isDefault: false,
    };
    this.#patchGroup(key, { items: [...group.items, item] });
  }

  openPicker(key: number) {
    this.$term.set('');
    this.$pickerKey.set(key);
  }

  closePicker() {
    this.$pickerKey.set(null);
    this.$term.set('');
  }

  /** valueAsNumber: NaN si se borra (la validación lo avisa al guardar). */
  numberOf(event: Event): number {
    return (event.target as HTMLInputElement).valueAsNumber;
  }

  textOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  checkedOf(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  #group(key: number): PackEditorGroup | undefined {
    return this.$groups().find((group) => group.key === key);
  }

  #patchGroup(key: number, patch: Partial<PackEditorGroup>) {
    this.#set(this.$groups().map((group) => (group.key === key ? { ...group, ...patch } : group)));
  }

  #set(groups: readonly PackEditorGroup[]) {
    this.content().$groups.set(groups);
  }
}
