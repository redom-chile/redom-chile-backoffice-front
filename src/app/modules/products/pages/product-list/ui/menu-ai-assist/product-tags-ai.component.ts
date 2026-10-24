import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { IconComponent, ToastService } from 'src/ui';
import { PlanLockBadgeComponent } from 'src/app/modules/products/shared';
import { ProductTagDto } from 'src/app/modules/public-menu/data-access';
import { MenuAiService, TagSuggestionDto } from 'src/app/modules/products/pages/menu-ai/data-access';
import { injectMenuAiAccess, MENU_AI_FEATURE, MENU_AI_SETTINGS_QUERY, MENU_AI_SETTINGS_ROUTE, toMenuAiFailure } from './menu-ai-assist';

export type TagIdsChange = Readonly<{ add: readonly number[]; remove: readonly number[] }>;

type SuggestionRow = Readonly<{ action: 'add' | 'remove'; tagId: number | null; name: string; reason: string }>;

/** "Sugerir etiquetas" según la receta: aceptar marca o desmarca la etiqueta en el formulario (se guarda con él). */
@Component({
  selector: 'app-product-tags-ai',
  imports: [IconComponent, PlanLockBadgeComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (access.canUse) {
    <div class="mb-2 flex flex-wrap items-center gap-1.5">
      @if (!access.$enabled()) {
      <button type="button" [class]="triggerClass" (click)="access.openUpsell()">
        <app-icon class="h-4 w-4" aria-hidden="true">lock</app-icon>Sugerir etiquetas
      </button>
      <app-plan-lock-badge [feature]="feature" />
      } @else {
      <button
        type="button"
        [class]="triggerClass"
        [attr.aria-disabled]="!productId() || $loading() ? 'true' : null"
        [attr.aria-expanded]="$rows() !== null || $disabledNotice()"
        [attr.aria-controls]="panelId"
        [title]="productId() ? 'Sugiere dieta y alérgenos según la receta' : 'Disponible después de guardar el producto'"
        (click)="suggest()">
        <app-icon class="h-4 w-4" [class.animate-spin]="$loading()" aria-hidden="true">{{ $loading() ? 'progress_activity' : 'auto_awesome' }}</app-icon>
        {{ $loading() ? 'Revisando la receta…' : 'Sugerir etiquetas' }}
      </button>
      @if (!productId()) {
      <span class="text-xs text-gray-500 dark:text-gray-400">Disponible después de guardar el producto.</span>
      }
      }
    </div>
    }

    <div [id]="panelId" #panel tabindex="-1" class="outline-none" aria-live="polite">
      @if ($disabledNotice()) {
      <div class="mb-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        <app-icon class="h-5 w-5 shrink-0" aria-hidden="true">info</app-icon>
        <p class="flex-1">
          La IA está apagada para tu negocio. Actívala en
          <a [routerLink]="settingsRoute" [queryParams]="settingsQuery" target="_blank" class="text-primary font-medium underline">Carta → Mejorar con IA → Configuración</a>.
        </p>
        <button type="button" class="shrink-0 text-gray-500 hover:text-gray-700" aria-label="Cerrar aviso" (click)="$disabledNotice.set(false)">
          <app-icon class="h-4 w-4" aria-hidden="true">close</app-icon>
        </button>
      </div>
      }

      @if ($rows(); as rows) {
      <section class="mb-3 rounded-md border border-gray-200 p-3 dark:border-gray-700" aria-label="Etiquetas sugeridas">
        <div class="mb-2 flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Etiquetas sugeridas</p>
          <div class="flex shrink-0 items-center gap-3">
            @if ($pending().length > 1) {
            <button type="button" class="text-primary text-xs font-medium hover:underline" (click)="acceptAll()">Aceptar todas</button>
            }
            <button type="button" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Cerrar sugerencias" (click)="$rows.set(null)">
              <app-icon class="h-5 w-5" aria-hidden="true">close</app-icon>
            </button>
          </div>
        </div>
        @if (rows.length) {
        <ul class="space-y-2">
          @for (row of rows; track row.action + row.name) {
          @let done = isApplied(row);
          <li class="flex items-start gap-2 text-sm">
            <app-icon class="mt-0.5 h-4 w-4 shrink-0" [class]="row.action === 'add' ? 'text-green-600' : 'text-red-600'" aria-hidden="true">
              {{ row.action === 'add' ? 'add_circle' : 'remove_circle' }}
            </app-icon>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-700 dark:text-gray-300">
                {{ row.action === 'add' ? 'Agregar' : 'Quitar' }} «{{ row.name }}»
              </p>
              @if (row.reason) {
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ row.reason }}</p>
              }
            </div>
            @if (row.tagId === null) {
            <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">No está en tus etiquetas</span>
            } @else if (done) {
            <span class="inline-flex shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <app-icon class="h-4 w-4" aria-hidden="true">check</app-icon>Aplicada
            </span>
            } @else {
            <button
              type="button"
              class="text-primary shrink-0 text-xs font-medium hover:underline"
              [attr.aria-label]="(row.action === 'add' ? 'Agregar ' : 'Quitar ') + row.name"
              (click)="accept(row)">
              Aceptar
            </button>
            }
          </li>
          }
        </ul>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Revisa antes de guardar: los alérgenos son tu responsabilidad.</p>
        } @else {
        <p class="text-sm text-gray-600 dark:text-gray-300">
          No hay cambios sugeridos. Las sugerencias se basan en la receta: si el producto no tiene, configúrala en Inventario → Recetas.
        </p>
        }
      </section>
      }
    </div>
  `,
})
export class ProductTagsAiComponent {
  readonly productId = input<number | null>(null);
  readonly tags = input<readonly ProductTagDto[]>([]);
  readonly selected = input<readonly number[]>([]);
  readonly tagsChange = output<TagIdsChange>();

  readonly #service = inject(MenuAiService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #injector = inject(Injector);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected readonly access = injectMenuAiAccess();
  protected readonly feature = MENU_AI_FEATURE;
  protected readonly settingsRoute = MENU_AI_SETTINGS_ROUTE;
  protected readonly settingsQuery = MENU_AI_SETTINGS_QUERY;
  protected readonly panelId = `product-tags-ai-${nextId++}`;
  protected readonly triggerClass =
    'text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:no-underline';

  protected readonly $loading = signal(false);
  protected readonly $rows = signal<readonly SuggestionRow[] | null>(null);
  protected readonly $disabledNotice = signal(false);
  protected readonly $pending = computed(() => (this.$rows() ?? []).filter((row) => row.tagId !== null && !this.isApplied(row)));

  suggest() {
    const id = this.productId();
    if (this.$loading()) return;
    if (!id) {
      this.#toast.show('Guarda el producto para pedir etiquetas con IA.', 'warning');
      return;
    }
    this.$loading.set(true);
    this.$disabledNotice.set(false);
    this.#service
      .suggestTags({ productIds: [id] })
      .pipe(
        finalize(() => this.$loading.set(false)),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: (result) => {
          const suggestion = result.suggestions.find((item) => item.productId === id);
          this.$rows.set(
            suggestion ? [...suggestion.add.map((tag) => this.#toRow('add', tag)), ...suggestion.remove.map((tag) => this.#toRow('remove', tag))] : [],
          );
          this.#focusPanel();
        },
        error: (error) => {
          const failure = toMenuAiFailure(error, 'No se pudieron pedir las etiquetas sugeridas.');
          if (failure.kind === 'disabled') {
            this.$rows.set(null);
            this.$disabledNotice.set(true);
            this.#focusPanel();
          } else if (failure.message) {
            this.#toast.show(failure.message, 'error');
          }
        },
      });
  }

  isApplied(row: SuggestionRow): boolean {
    if (row.tagId === null) return false;
    const selected = this.selected().includes(row.tagId);
    return row.action === 'add' ? selected : !selected;
  }

  accept(row: SuggestionRow) {
    if (row.tagId === null) return;
    this.tagsChange.emit(row.action === 'add' ? { add: [row.tagId], remove: [] } : { add: [], remove: [row.tagId] });
  }

  acceptAll() {
    const pending = this.$pending();
    this.tagsChange.emit({
      add: pending.filter((row) => row.action === 'add').map((row) => row.tagId!),
      remove: pending.filter((row) => row.action === 'remove').map((row) => row.tagId!),
    });
  }

  // El backend responde por código; se cruza con el catálogo del negocio para obtener el id.
  #toRow(action: SuggestionRow['action'], tag: TagSuggestionDto): SuggestionRow {
    const known = this.tags().find((item) => item.code === tag.code);
    return { action, tagId: known?.id ?? null, name: known?.name ?? tag.name, reason: tag.reason };
  }

  #focusPanel() {
    afterNextRender(() => this.panel().nativeElement.focus(), { injector: this.#injector });
  }
}

let nextId = 0;
