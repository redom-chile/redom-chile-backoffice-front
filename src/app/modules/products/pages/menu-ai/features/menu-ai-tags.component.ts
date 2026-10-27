import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, EmptyStateComponent, IconComponent, ToastService } from 'src/ui';
import { MenuAiService, TagSuggestionsDto } from '../data-access';
import { MenuAiTab, TAGS_PICK_MAX } from '../menu-ai-shared';
import { MenuAiStore, TagChoice, TagDraft } from '../menu-ai.store';
import { MenuAiCalloutComponent } from './menu-ai-callout.component';
import { openMenuAiProductPicker } from './menu-ai-product-picker-modal.component';

const KIND_LABELS: Record<string, string> = { diet: 'Dieta', allergen: 'Alérgeno', badge: 'Destacado' };

/** Etiquetas sugeridas a partir de la receta: se revisan y se aplican por producto. */
@Component({
  selector: 'app-menu-ai-tags',
  imports: [CheckPermissionDirective, ButtonComponent, EmptyStateComponent, IconComponent, MenuAiCalloutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let canAct = $canAct();
    @if (!store.$unavailable() && store.$isEnabled() === false) {
    <app-menu-ai-callout (openSettings)="goTo.emit('settings')" />
    }
    @if (!store.$canUpdateProducts()) {
    <p class="text-muted-foreground mb-4 text-sm" role="note">Necesitas el permiso para editar productos para revisar y aplicar etiquetas.</p>
    }

    <div class="mb-4 flex flex-col gap-2">
      <p class="text-muted-foreground text-sm">
        La IA revisa los ingredientes de la receta y te propone etiquetas de dieta y alérgenos. Solo se cambian las que marques.
      </p>
      <div class="flex flex-wrap gap-2">
        <app-button impact="bold" tone="primary" size="small" type="button" icon="auto_awesome" [disabled]="!canAct || $requesting()" (buttonClick)="reviewMissing()">
          Revisar productos con receta
        </app-button>
        <app-button impact="light" tone="primary" size="small" type="button" icon="checklist" [disabled]="!canAct || $requesting()" (buttonClick)="pickProducts()">
          Elegir productos
        </app-button>
      </div>
    </div>

    @if ($requesting()) {
    <div class="glass mb-4 flex flex-col items-center gap-3 rounded-[1rem] px-5 py-8 text-center" role="status" aria-live="polite">
      <span class="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" aria-hidden="true"></span>
      <p class="text-foreground font-medium">La IA está revisando las recetas…</p>
    </div>
    }

    @if ($items().length) {
    <div class="flex flex-col gap-3">
      @for (item of $items(); track item.productId) {
      @let busy = $applyingId() === item.productId;
      <article class="glass rounded-[1rem] p-4" [attr.aria-labelledby]="'menu-ai-tags-' + item.productId" [attr.aria-busy]="busy">
        <header class="mb-3 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 [id]="'menu-ai-tags-' + item.productId" class="text-foreground font-semibold">{{ item.productName }}</h3>
            <p class="text-muted-foreground text-xs">Hoy: {{ currentNames(item) || 'sin etiquetas' }}</p>
          </div>
          <button type="button" class="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium" [disabled]="busy" (click)="discard(item)">Descartar</button>
        </header>

        @if (item.add.length) {
        <fieldset class="mb-3">
          <legend class="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">Agregar</legend>
          <ul class="flex flex-col gap-1">
            @for (tag of item.add; track tag.code) {
            <li>
              <label class="glass-row flex cursor-pointer items-start gap-3 rounded-lg p-2.5">
                <input type="checkbox" class="accent-primary mt-0.5 h-4 w-4 shrink-0" [checked]="tag.checked" [disabled]="busy" (change)="toggle(item, 'add', tag)" />
                <span class="min-w-0">
                  <span class="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-300">
                    <app-icon class="h-3.5 w-3.5" aria-hidden="true">add</app-icon>{{ tag.name }}
                  </span>
                  <span class="text-muted-foreground ml-1 text-xs">{{ kindLabel(tag.kind) }}</span>
                  <span class="text-muted-foreground block text-xs">{{ tag.reason }}</span>
                </span>
              </label>
            </li>
            }
          </ul>
        </fieldset>
        }

        @if (item.remove.length) {
        <fieldset class="mb-3">
          <legend class="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">Quitar</legend>
          <ul class="flex flex-col gap-1">
            @for (tag of item.remove; track tag.code) {
            <li>
              <label class="glass-row flex cursor-pointer items-start gap-3 rounded-lg p-2.5">
                <input type="checkbox" class="accent-primary mt-0.5 h-4 w-4 shrink-0" [checked]="tag.checked" [disabled]="busy" (change)="toggle(item, 'remove', tag)" />
                <span class="min-w-0">
                  <span class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                    <app-icon class="h-3.5 w-3.5" aria-hidden="true">remove</app-icon>{{ tag.name }}
                  </span>
                  <span class="text-muted-foreground ml-1 text-xs">{{ kindLabel(tag.kind) }}</span>
                  <span class="text-muted-foreground block text-xs">{{ tag.reason }}</span>
                </span>
              </label>
            </li>
            }
          </ul>
        </fieldset>
        }

        <div class="flex justify-end">
          <app-button
            *appCheckPermission="PERMISSIONS.PRODUCTS.UPDATE_PRODUCT"
            impact="bold"
            tone="primary"
            size="small"
            type="button"
            icon="done"
            [isLoading]="busy"
            [disabled]="!hasChecked(item) || !!$applyingId() || store.$unavailable() || !$catalogReady()"
            (buttonClick)="apply(item)">
            Aplicar
          </app-button>
        </div>
      </article>
      }
    </div>
    } @else if (!$requesting() && store.$tagsReviewed()) {
    <app-empty-state icon="task_alt" title="Sin cambios sugeridos" description="Las etiquetas de los productos revisados coinciden con sus recetas." />
    } @else if (!$requesting()) {
    <app-empty-state icon="sell" title="Etiquetas según la receta" description="Revisa los productos con receta para saber qué etiquetas de dieta y alérgenos les faltan o sobran." />
    }
  `,
})
export class MenuAiTagsComponent {
  readonly #service = inject(MenuAiService);
  readonly #menuSettings = inject(MenuSettingsService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly store = inject(MenuAiStore);

  readonly PERMISSIONS = PERMISSIONS;
  readonly goTo = output<MenuAiTab>();

  readonly $items = this.store.$tags;
  readonly $requesting = signal(false);
  readonly $applyingId = signal<number | null>(null);
  readonly $canAct = computed(() => !this.store.$unavailable() && this.store.$canUpdateProducts() && this.store.$isEnabled() !== false);

  // Catálogo de etiquetas: las sugerencias vienen por código y el endpoint de etiquetas usa ids.
  readonly catalog = rxResource({
    params: () => (this.$items().length ? true : undefined),
    stream: () => this.#menuSettings.getTags().pipe(toRemoteResult()),
  });
  readonly #idByCode = computed(() => new Map((resultValue(this.catalog.value()) ?? []).map((tag) => [tag.code, tag.id])));
  readonly $catalogReady = computed(() => this.#idByCode().size > 0);

  currentNames(item: TagDraft): string {
    return item.current.map((tag) => tag.name).join(', ');
  }

  kindLabel(kind: string): string {
    return KIND_LABELS[kind] ?? '';
  }

  reviewMissing() {
    this.#request({ scope: 'missing' });
  }

  pickProducts() {
    openMenuAiProductPicker(this.#dialog, { title: 'Elegir productos con receta', max: TAGS_PICK_MAX, confirmText: 'Revisar etiquetas' })
      .pipe(filter((picked) => !!picked?.length))
      .subscribe((picked) => this.#request({ productIds: picked!.map((product) => product.id) }));
  }

  #request(dto: { productIds?: number[]; scope?: 'missing' }) {
    if (this.$requesting() || !this.$canAct()) return;
    this.$requesting.set(true);
    this.#service.suggestTags(dto).subscribe({
      next: (result) => {
        this.$requesting.set(false);
        this.store.$tagsReviewed.set(true);
        this.#merge(result);
      },
      error: (error: unknown) => {
        this.$requesting.set(false);
        this.store.handleError(error, 'No se pudieron revisar las etiquetas.');
      },
    });
  }

  #merge(result: TagSuggestionsDto) {
    const fresh = result.suggestions
      .filter((suggestion) => suggestion.add.length || suggestion.remove.length)
      .map(
        (suggestion): TagDraft => ({
          productId: suggestion.productId,
          productName: suggestion.productName,
          current: suggestion.current ?? [],
          add: suggestion.add.map((tag) => ({ ...tag, checked: true })),
          remove: suggestion.remove.map((tag) => ({ ...tag, checked: true })),
        }),
      );
    const ids = new Set(fresh.map((item) => item.productId));
    this.$items.update((items) => [...items.filter((item) => !ids.has(item.productId)), ...fresh]);
  }

  toggle(item: TagDraft, list: 'add' | 'remove', tag: TagChoice) {
    this.$items.update((items) =>
      items.map((current) =>
        current.productId === item.productId
          ? { ...current, [list]: current[list].map((choice) => (choice.code === tag.code ? { ...choice, checked: !choice.checked } : choice)) }
          : current,
      ),
    );
  }

  hasChecked(item: TagDraft): boolean {
    return [...item.add, ...item.remove].some((tag) => tag.checked);
  }

  discard(item: TagDraft) {
    this.$items.update((items) => items.filter((current) => current.productId !== item.productId));
  }

  apply(item: TagDraft) {
    if (this.$applyingId() || !this.hasChecked(item)) return;
    const idByCode = this.#idByCode();
    const toId = (tag: { code: string }) => idByCode.get(tag.code);
    const current = item.current.map(toId);
    const add = item.add.filter((tag) => tag.checked).map(toId);
    const remove = new Set(item.remove.filter((tag) => tag.checked).map(toId));
    // PUT /products/{id}/tags reemplaza todas por ids: si falta alguna en el catálogo se borraría.
    if ([...current, ...add].some((id) => id === undefined) || remove.has(undefined)) {
      this.#toast.show('Una de las etiquetas ya no existe. Vuelve a revisar el producto.', 'warning');
      return;
    }
    const ids = new Set(current.filter((id) => !remove.has(id)) as number[]);
    add.forEach((id) => ids.add(id!));

    this.$applyingId.set(item.productId);
    this.#menuSettings.setProductTags(item.productId, [...ids]).subscribe({
      next: () => {
        this.$applyingId.set(null);
        this.discard(item);
        this.store.refreshOverview();
        this.#toast.show(`Actualizamos las etiquetas de ${item.productName}`, 'success');
      },
      error: (error: unknown) => {
        this.$applyingId.set(null);
        this.store.handleError(error, 'No se pudieron guardar las etiquetas.');
      },
    });
  }
}
