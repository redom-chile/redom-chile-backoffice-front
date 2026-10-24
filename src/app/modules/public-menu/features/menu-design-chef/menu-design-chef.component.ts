import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { ImageSelection } from 'src/app/core/services/file-upload';
import { CHEF_PICKS_MAX, ChefPicksDto, DAY_SHORT } from 'src/app/modules/public-menu/data-access';
import { WEEK_ORDER } from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { CHEF_TITLE_MAX, CHEF_TITLE_SUGGESTIONS, ChefDraft, ChefRange } from 'src/app/modules/public-menu/features/menu-design-shared';
import { IconComponent, ImagePickerComponent, ToggleComponent } from 'src/ui';

/** Producto de la carta del local que se puede recomendar. */
export type ChefProductOption = Readonly<{ id: number; name: string; imageUrl: string | null; soldOut: boolean; category: string }>;

type Picked = Readonly<{ id: number; name: string; imageUrl: string | null; soldOut: boolean; hidden: boolean }>;

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const RESULTS_LIMIT = 30;

/** Pestaña Recomendaciones del chef: título, foto, productos en orden y horario. */
@Component({
  selector: 'app-menu-design-chef',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, IconComponent, ToggleComponent, ImagePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-design-chef.component.html',
})
export class MenuDesignChefComponent {
  readonly draft = model.required<ChefDraft>();
  readonly catalog = input<readonly ChefProductOption[]>([]);
  readonly catalogNote = input<string | null>(null);
  /** Estado que informa el backend de lo ya guardado (incluye ocultos que no están en la carta). */
  readonly known = input<ChefPicksDto['products']>([]);
  readonly photoUrl = input<string | null>(null);
  /** Cambia para reiniciar el selector de foto. */
  readonly pickerKey = input(0);
  readonly uploading = input(false);
  readonly progress = input(0);
  readonly disabled = input(false);
  readonly photoChange = output<ImageSelection>();

  protected readonly max = CHEF_PICKS_MAX;
  protected readonly titleMax = CHEF_TITLE_MAX;
  protected readonly suggestions = CHEF_TITLE_SUGGESTIONS;
  protected readonly week = WEEK_ORDER;
  protected readonly dayNames = DAY_SHORT;
  protected readonly id = `chef-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly search = signal('');

  readonly #catalogById = computed(() => new Map(this.catalog().map((product) => [product.id, product] as const)));
  readonly #knownById = computed(() => new Map(this.known().map((product) => [product.id, product] as const)));

  protected readonly $picked = computed<Picked[]>(() =>
    this.draft().productIds.map((id) => {
      const inMenu = this.#catalogById().get(id);
      const known = this.#knownById().get(id);
      return {
        id,
        name: inMenu?.name ?? known?.name ?? `Producto ${id}`,
        imageUrl: inMenu?.imageUrl ?? known?.imageUrl ?? null,
        soldOut: inMenu?.soldOut ?? known?.soldOut ?? false,
        // Si no está en la carta pública del local, no se ve.
        hidden: known?.hidden ?? !inMenu,
      };
    }),
  );
  protected readonly $full = computed(() => this.draft().productIds.length >= CHEF_PICKS_MAX);
  protected readonly $results = computed(() => {
    const picked = new Set(this.draft().productIds);
    const query = normalize(this.search().trim());
    return this.catalog()
      .filter((product) => !picked.has(product.id) && (!query || normalize(product.name).includes(query) || normalize(product.category).includes(query)))
      .slice(0, RESULTS_LIMIT);
  });
  protected readonly $titleLength = computed(() => this.draft().title.length);

  patch(changes: Partial<ChefDraft>) {
    this.draft.update((draft) => ({ ...draft, ...changes }));
  }

  add(productId: number) {
    if (this.$full()) return;
    this.patch({ productIds: [...this.draft().productIds, productId] });
  }

  remove(productId: number) {
    this.patch({ productIds: this.draft().productIds.filter((id) => id !== productId) });
  }

  move(index: number, delta: number) {
    const ids = [...this.draft().productIds];
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    moveItemInArray(ids, index, to);
    this.patch({ productIds: ids });
  }

  drop(event: CdkDragDrop<unknown>) {
    if (event.previousIndex === event.currentIndex) return;
    const ids = [...this.draft().productIds];
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.patch({ productIds: ids });
  }

  addRange() {
    this.patch({ ranges: [...this.draft().ranges, { days: [], startTime: '12:00', endTime: '16:00' }] });
  }

  patchRange(index: number, changes: Partial<ChefRange>) {
    this.patch({ ranges: this.draft().ranges.map((range, i) => (i === index ? { ...range, ...changes } : range)) });
  }

  toggleDay(index: number, day: number) {
    const days = this.draft().ranges[index].days;
    this.patchRange(index, { days: days.includes(day) ? days.filter((item) => item !== day) : [...days, day] });
  }

  removeRange(index: number) {
    this.patch({ ranges: this.draft().ranges.filter((_, i) => i !== index) });
  }
}
