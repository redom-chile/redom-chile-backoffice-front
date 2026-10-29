import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, Injector, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { IconComponent, ToastService } from 'src/ui';
import { PlanLockBadgeComponent } from 'src/app/modules/products/shared';
import { AiQuotaDto, MenuAiService, quotaFromError } from 'src/app/modules/products/pages/menu-ai/data-access';
import { injectMenuAiAccess, MENU_AI_FEATURE, MENU_AI_SETTINGS_QUERY, MENU_AI_SETTINGS_ROUTE, quotaHint, toMenuAiFailure } from './menu-ai-assist';

/**
 * Campo "Descripción" con "Sugerir con IA": muestra 3 opciones y la elegida se copia al campo (se guarda con el formulario).
 * Proyecta el label (select="label") y el textarea.
 */
@Component({
  selector: 'app-product-description-ai',
  imports: [IconComponent, PlanLockBadgeComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
      <ng-content select="label" />
      @if (access.canUse) {
      <span class="inline-flex items-center gap-1.5">
        @if (!access.$enabled()) {
        <button type="button" [class]="triggerClass" (click)="access.openUpsell()">
          <app-icon class="h-4 w-4" aria-hidden="true">lock</app-icon>Sugerir con IA
        </button>
        <app-plan-lock-badge [feature]="feature" />
        } @else {
        <button
          type="button"
          [class]="triggerClass"
          [attr.aria-disabled]="!productId() || $loading() ? 'true' : null"
          [attr.aria-expanded]="$options() !== null || $disabledNotice()"
          [attr.aria-controls]="panelId"
          [attr.aria-describedby]="productId() ? null : hintId"
          [title]="productId() ? 'Sugiere 3 descripciones a partir del producto' : 'Disponible después de guardar el producto'"
          (click)="suggest()">
          <app-icon class="h-4 w-4" [class.animate-spin]="$loading()" aria-hidden="true">{{ $loading() ? 'progress_activity' : 'auto_awesome' }}</app-icon>
          {{ $loading() ? 'Pidiendo sugerencias…' : 'Sugerir con IA' }}
        </button>
        }
      </span>
      }
    </div>

    <ng-content />

    @if (access.canUse && access.$enabled()) {
    @if (!productId()) {
    <p [id]="hintId" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Guarda el producto para pedir descripciones con IA.</p>
    } @else if ($quota() === null) {
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Descripciones con IA: {{ quotaHint(access.$planQuota()) }}.</p>
    }
    }

    <div [id]="panelId" #panel tabindex="-1" class="outline-none" aria-live="polite">
      @if ($disabledNotice()) {
      <div class="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
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

      @if ($options(); as options) {
      <section class="mt-2 rounded-md border border-gray-200 p-3 dark:border-gray-700" aria-label="Descripciones sugeridas">
        <div class="mb-2 flex items-start justify-between gap-2">
          <div>
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Elige una descripción</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Se copia al campo; puedes editarla antes de guardar.</p>
          </div>
          <button type="button" class="shrink-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Cerrar sugerencias" (click)="close()">
            <app-icon class="h-5 w-5" aria-hidden="true">close</app-icon>
          </button>
        </div>
        @if (options.length) {
        <ul class="space-y-2">
          @for (option of options; track $index) {
          @let chosen = $chosen() === $index;
          <li>
            <button
              type="button"
              class="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors"
              [class]="chosen ? 'border-primary bg-primary/5 text-gray-900 dark:text-gray-100' : 'border-gray-300 text-gray-700 hover:border-[var(--primary)] dark:border-gray-600 dark:text-gray-300'"
              [attr.aria-pressed]="chosen"
              (click)="choose($index, option)">
              @if (chosen) {
              <app-icon class="text-primary float-right ml-2 h-4 w-4" aria-hidden="true">check</app-icon>
              }
              {{ option }}
            </button>
          </li>
          }
        </ul>
        } @else {
        <p class="text-sm text-gray-600 dark:text-gray-300">La IA no encontró una buena descripción para este producto. Escríbela tú en el campo.</p>
        }
        @if ($quota(); as quota) {
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Descripciones con IA: {{ quotaHint(quota) }}.</p>
        }
      </section>
      }
    </div>
  `,
})
export class ProductDescriptionAiComponent {
  readonly productId = input<number | null>(null);
  readonly pick = output<string>();

  readonly #service = inject(MenuAiService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #injector = inject(Injector);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected readonly access = injectMenuAiAccess();
  protected readonly feature = MENU_AI_FEATURE;
  protected readonly settingsRoute = MENU_AI_SETTINGS_ROUTE;
  protected readonly settingsQuery = MENU_AI_SETTINGS_QUERY;
  protected readonly panelId = `product-description-ai-${nextId}`;
  protected readonly hintId = `product-description-ai-hint-${nextId++}`;
  protected readonly triggerClass =
    'text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:no-underline';

  protected readonly $loading = signal(false);
  protected readonly $options = signal<readonly string[] | null>(null);
  protected readonly $chosen = signal<number | null>(null);
  protected readonly $quota = signal<AiQuotaDto | null>(null);
  protected readonly $disabledNotice = signal(false);

  suggest() {
    const id = this.productId();
    if (this.$loading()) return;
    if (!id) {
      this.#toast.show('Guarda el producto para pedir descripciones con IA.', 'warning');
      return;
    }
    this.$loading.set(true);
    this.$disabledNotice.set(false);
    this.#service
      .suggestDescriptions({ productIds: [id] })
      .pipe(
        finalize(() => this.$loading.set(false)),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: (result) => {
          const suggestion = result.suggestions.find((item) => item.productId === id) ?? result.suggestions[0];
          this.$options.set(suggestion?.options ?? []);
          this.$chosen.set(null);
          this.$quota.set(result.quota ?? null);
          this.#focusPanel();
        },
        error: (error) => {
          const quota = quotaFromError(error);
          if (quota?.period === 'month') this.$quota.set({ used: quota.used, limit: quota.limit });
          const failure = toMenuAiFailure(error, 'No se pudieron pedir las sugerencias.');
          if (failure.kind === 'disabled') {
            this.$options.set(null);
            this.$disabledNotice.set(true);
            this.#focusPanel();
          } else if (failure.message) {
            this.#toast.show(failure.message, 'error');
          }
        },
      });
  }

  choose(index: number, option: string) {
    this.$chosen.set(index);
    this.pick.emit(option);
  }

  close() {
    this.$options.set(null);
    this.$chosen.set(null);
  }

  protected readonly quotaHint = quotaHint;

  #focusPanel() {
    afterNextRender(() => this.panel().nativeElement.focus(), { injector: this.#injector });
  }
}

let nextId = 0;
