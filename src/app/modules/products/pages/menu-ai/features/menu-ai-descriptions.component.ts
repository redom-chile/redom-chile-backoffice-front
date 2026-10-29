import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { concatMap, filter, from, reduce } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, EmptyStateComponent, IconComponent, ToastService } from 'src/ui';
import { DescriptionSuggestionsDto, MenuAiService, RequestDescriptionsDto } from '../data-access';
import { APPLY_CHUNK, MenuAiTab, plural, SUGGEST_MAX } from '../menu-ai-shared';
import { DescriptionDraft, MenuAiStore } from '../menu-ai.store';
import { MenuAiCalloutComponent } from './menu-ai-callout.component';
import { openMenuAiProductPicker } from './menu-ai-product-picker-modal.component';
import { MenuAiQuotaComponent } from './menu-ai-quota.component';

/** Descripciones sugeridas: se piden de a 20, se eligen o editan y se aplican juntas. */
@Component({
  selector: 'app-menu-ai-descriptions',
  imports: [CheckPermissionDirective, ButtonComponent, EmptyStateComponent, IconComponent, MenuAiCalloutComponent, MenuAiQuotaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-ai-descriptions.component.html',
})
export class MenuAiDescriptionsComponent {
  readonly #service = inject(MenuAiService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly store = inject(MenuAiStore);

  readonly PERMISSIONS = PERMISSIONS;
  readonly goTo = output<MenuAiTab>();

  readonly $items = this.store.$descriptions;
  readonly $remaining = this.store.$remaining;
  readonly $max = this.store.$descriptionMax;
  readonly $requesting = signal(false);
  readonly $applying = signal(false);

  readonly $canAct = computed(() => !this.store.$unavailable() && this.store.$canUpdateProducts() && this.store.$isEnabled() !== false);
  /** Cuota del mes agotada (null = sin límite). */
  readonly $quotaExhausted = computed(() => {
    const quota = this.store.$quota();
    return !!quota && quota.limit !== null && quota.used >= quota.limit;
  });
  readonly $pending = computed(() => this.$items().filter((item) => !item.skipped));
  /** Se aplican las que tienen texto válido y distinto al actual. */
  readonly $ready = computed(() =>
    this.$pending().filter((item) => {
      const text = item.text.trim();
      return !!text && text.length <= this.$max() && text !== (item.current ?? '').trim();
    }),
  );
  readonly $tooLong = computed(() => this.$pending().filter((item) => item.text.trim().length > this.$max()).length);
  // "Continuar" pide la siguiente tanda: antes hay que resolver la actual (si no, el servidor devuelve las mismas).
  readonly $canContinue = computed(() => (this.$remaining() ?? 0) > 0 && !this.$pending().length);

  completeMissing() {
    const excludeIds = [...this.store.$skippedIds()];
    this.#request(excludeIds.length ? { scope: 'missing', excludeIds } : { scope: 'missing' }, true);
  }

  pickProducts() {
    openMenuAiProductPicker(this.#dialog, { title: 'Elegir productos', max: SUGGEST_MAX, confirmText: 'Sugerir descripciones' })
      .pipe(filter((picked) => !!picked?.length))
      .subscribe((picked) => this.#request({ productIds: picked!.map((product) => product.id) }, false));
  }

  #request(dto: RequestDescriptionsDto, missing: boolean) {
    if (this.$requesting() || !this.$canAct()) return;
    this.$requesting.set(true);
    this.#service.suggestDescriptions(dto).subscribe({
      next: (result) => {
        this.$requesting.set(false);
        this.#merge(result);
        this.$remaining.set(missing ? result.remaining : null);
        this.store.$quota.update((quota) => ({ ...quota, ...result.quota }));
        const { used, limit } = result.quota;
        const requested = dto.productIds?.length ?? 0;
        // Si la cuota no alcanza, el servidor procesa solo los que caben.
        const cut = limit !== null && used >= limit && (missing ? result.remaining > 0 : result.suggestions.length < requested);
        if (cut) {
          this.#toast.show(`La cuota del mes alcanzó para ${plural(result.suggestions.length, 'producto', 'productos')}. El resto puedes escribirlo a mano.`, 'warning');
        } else if (!result.suggestions.length) {
          this.#toast.show(missing ? 'No hay productos sin descripción' : 'La IA no pudo sugerir descripciones esta vez', missing ? 'success' : 'warning');
        }
      },
      error: (error: unknown) => {
        this.$requesting.set(false);
        this.store.handleError(error, 'No se pudieron pedir las sugerencias.');
      },
    });
  }

  #merge(result: DescriptionSuggestionsDto) {
    const fresh = result.suggestions.map(
      (suggestion): DescriptionDraft => ({
        productId: suggestion.productId,
        productName: suggestion.productName,
        current: suggestion.current,
        options: suggestion.options,
        choice: suggestion.options.length ? 0 : null,
        text: suggestion.options[0] ?? '',
        skipped: false,
      }),
    );
    const ids = new Set(fresh.map((item) => item.productId));
    this.$items.update((items) => [...items.filter((item) => !ids.has(item.productId)), ...fresh]);
    // Pedido de nuevo a mano: deja de estar omitido.
    this.store.$skippedIds.update((skipped) => new Set([...skipped].filter((id) => !ids.has(id))));
  }

  #patch(productId: number, change: Partial<DescriptionDraft>) {
    this.$items.update((items) => items.map((item) => (item.productId === productId ? { ...item, ...change } : item)));
  }

  choose(item: DescriptionDraft, index: number) {
    this.#patch(item.productId, { choice: index, text: item.options[index] ?? '' });
  }

  onText(item: DescriptionDraft, event: Event) {
    const text = (event.target as HTMLTextAreaElement).value;
    const index = item.options.indexOf(text);
    this.#patch(item.productId, { text, choice: index >= 0 ? index : null });
  }

  toggleSkip(item: DescriptionDraft) {
    const skipped = !item.skipped;
    this.#patch(item.productId, { skipped });
    this.store.$skippedIds.update((ids) => {
      const next = new Set(ids);
      if (skipped) next.add(item.productId);
      else next.delete(item.productId);
      return next;
    });
  }

  clearSkipped() {
    this.$items.update((items) => items.filter((item) => !item.skipped));
  }

  apply() {
    const ready = this.$ready();
    if (this.$applying() || !ready.length || this.store.$unavailable()) return;
    const chunks: DescriptionDraft[][] = [];
    for (let i = 0; i < ready.length; i += APPLY_CHUNK) chunks.push(ready.slice(i, i + APPLY_CHUNK));

    this.$applying.set(true);
    const applied = new Set<number>();
    from(chunks)
      .pipe(
        concatMap((chunk) => {
          const items = chunk.map((item) => ({ productId: item.productId, description: item.text.trim() }));
          return this.#service.applyDescriptions({ items }).pipe(
            reduce((count, result) => {
              chunk.forEach((item) => applied.add(item.productId));
              return count + result.count;
            }, 0),
          );
        }),
        reduce((total, count) => total + count, 0),
      )
      .subscribe({
        next: (count) => {
          this.$applying.set(false);
          this.#removeApplied(applied);
          this.#toast.show(`Guardamos ${plural(count, 'descripción', 'descripciones')}`, 'success');
        },
        error: (error: unknown) => {
          this.$applying.set(false);
          // Lo que alcanzó a guardarse sale de la lista; el resto queda para reintentar.
          this.#removeApplied(applied);
          this.store.handleError(error, 'No se pudieron guardar las descripciones.');
        },
      });
  }

  #removeApplied(ids: ReadonlySet<number>) {
    if (!ids.size) return;
    this.$items.update((items) => items.filter((item) => !ids.has(item.productId)));
    this.store.refreshOverview();
  }

  trackLength(item: DescriptionDraft): number {
    return item.text.trim().length;
  }
}
