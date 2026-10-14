import { ChangeDetectionStrategy, Component, computed, inject, input, model, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { catchError, firstValueFrom, Observable, of } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { IconComponent, ToastService } from 'src/ui';
import { MenuSettingsService, ProductTagDto } from 'src/app/modules/public-menu/data-access';

const KIND_GROUPS = [
  { kind: 'diet', label: 'Dieta' },
  { kind: 'allergen', label: 'Alérgenos' },
  { kind: 'badge', label: 'Destacados' },
] as const;

/** Etiquetas de la carta pública (dieta, alérgenos, destacados): chips que se marcan y desmarcan. */
@Component({
  selector: 'app-product-tags-field',
  imports: [NgClass, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset>
      <legend class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Etiquetas</legend>
      <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">Se muestran en la carta QR y sirven para filtrar.</p>
      @for (group of $groups(); track group.kind) {
      <div class="mb-2">
        <p class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ group.label }}</p>
        <div class="flex flex-wrap gap-2">
          @for (tag of group.tags; track tag.id) {
          @let active = isSelected(tag.id);
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors"
            [ngClass]="
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            "
            [attr.aria-pressed]="active"
            (click)="toggle(tag.id)">
            @if (active) {
            <app-icon class="h-4 w-4">check</app-icon>
            }
            {{ tag.name }}
          </button>
          }
        </div>
      </div>
      }
      @if (note()) {
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ note() }}</p>
      }
    </fieldset>
  `,
})
export class ProductTagsFieldComponent {
  readonly tags = input<readonly ProductTagDto[]>([]);
  readonly selected = model<readonly number[]>([]);
  readonly note = input<string | null>(null);

  readonly $groups = computed(() => {
    const tags = [...this.tags()].sort((a, b) => a.position - b.position);
    const known: readonly string[] = KIND_GROUPS.map((group) => group.kind);
    const groups: { kind: string; label: string; tags: ProductTagDto[] }[] = KIND_GROUPS.map((group) => ({
      ...group,
      tags: tags.filter((tag) => tag.kind === group.kind),
    }));
    // Un tipo nuevo del backend no se pierde: va en "Otras".
    groups.push({ kind: 'other', label: 'Otras', tags: tags.filter((tag) => !known.includes(tag.kind)) });
    return groups.filter((group) => group.tags.length);
  });

  isSelected(id: number): boolean {
    return this.selected().includes(id);
  }

  toggle(id: number) {
    this.selected.update((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  }
}

/** true si las dos listas tienen las mismas etiquetas (sin importar el orden). */
export function sameTagIds(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * Catálogo de etiquetas, solo si el usuario puede guardarlas (mismo permiso que editar productos).
 * Sin permiso o si falla la carga queda vacío y el campo no se muestra. Llamar en contexto de inyección.
 */
export function injectEditableProductTags(): Signal<readonly ProductTagDto[]> {
  const canEdit = inject(AccessService).can(PERMISSIONS.PRODUCTS.UPDATE_PRODUCT);
  const empty: ProductTagDto[] = [];
  const source: Observable<ProductTagDto[]> = canEdit
    ? inject(MenuSettingsService).getTags().pipe(catchError(() => of(empty)))
    : of(empty);
  return toSignal(source, { initialValue: empty });
}

/**
 * Guarda las etiquetas tras guardar el producto, solo si cambiaron. Si fallan, el producto ya quedó guardado:
 * se avisa y se sigue.
 */
export async function saveProductTagsIfChanged(
  service: MenuSettingsService,
  toast: ToastService,
  productId: number | null,
  tagIds: readonly number[],
  initialTagIds: readonly number[],
): Promise<void> {
  if (!productId || sameTagIds(tagIds, initialTagIds)) return;
  try {
    await firstValueFrom(service.setProductTags(productId, [...tagIds]));
  } catch {
    toast.show('El producto se guardó, pero no se pudieron guardar las etiquetas', 'warning');
  }
}
