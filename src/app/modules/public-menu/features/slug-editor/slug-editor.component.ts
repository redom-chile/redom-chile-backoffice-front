import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import {
  getPublicMenuErrorMessage,
  MenuSettingsDto,
  MenuSettingsService,
  SLUG_REASON_LABELS,
} from 'src/app/modules/public-menu/data-access';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, IconComponent, ToastService } from 'src/ui';

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Editor de un slug con verificación en vivo (400 ms). Sin locationId edita el del negocio (afecta a todos los
 * locales); con locationId, el del local. Al guardar emite las cartas actualizadas.
 */
@Component({
  selector: 'app-slug-editor',
  imports: [ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label [for]="$inputId()" class="text-foreground mb-1 block text-sm font-medium">{{ label() }}</label>
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div class="glass-input flex min-w-0 flex-1 items-center overflow-hidden rounded-md text-sm">
        <span class="text-muted-foreground max-w-[50%] shrink-0 truncate py-2 pl-3" [title]="prefix()">{{ prefix() }}</span>
        <input
          [id]="$inputId()"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength="60"
          class="min-w-0 flex-1 bg-transparent py-2 pr-3 outline-none"
          [value]="$draft()"
          [disabled]="$isSaving()"
          (input)="onInput($event)"
          (keydown.enter)="save()" />
      </div>
      <app-button
        impact="bold"
        tone="primary"
        size="small"
        type="button"
        [disabled]="!$canSave()"
        [isLoading]="$isSaving()"
        (buttonClick)="save()">
        Guardar dirección
      </app-button>
    </div>

    @switch ($status().kind) {
      @case ('checking') {
      <p class="text-muted-foreground mt-1 text-xs">Verificando…</p>
      }
      @case ('available') {
      <p class="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <app-icon class="h-4 w-4" aria-hidden="true">check_circle</app-icon>Disponible
      </p>
      }
      @case ('unavailable') {
      <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-red-600 dark:text-red-400">
        <span>{{ $status().message }}</span>
        @if ($status().suggestion; as suggestion) {
        <span class="text-muted-foreground">Prueba con <strong class="text-foreground">{{ suggestion }}</strong></span>
        <button type="button" class="text-primary font-semibold hover:underline" (click)="use(suggestion)">Usar</button>
        }
      </p>
      }
    }
    <p class="text-muted-foreground mt-1 flex items-start gap-1 text-xs">
      <app-icon class="h-4 w-4 shrink-0" aria-hidden="true">info</app-icon>
      <span>La dirección anterior seguirá funcionando y redirigirá a la nueva.</span>
    </p>
  `,
})
export class SlugEditorComponent {
  readonly #service = inject(MenuSettingsService);
  readonly #toast = inject(ToastService);
  readonly #dialog = inject(MatDialog);

  readonly current = input.required<string | null>();
  /** null: slug del negocio. */
  readonly locationId = input<number | null>(null);
  readonly label = input('Dirección');
  readonly prefix = input('');
  readonly saved = output<MenuSettingsDto[]>();

  readonly $inputId = computed(() => `slug-${this.locationId() ?? 'business'}`);
  readonly $draft = linkedSignal(() => this.current() ?? '');
  readonly $isSaving = signal(false);
  // Sugerencia que llega en el 409 SLUG_TAKEN al guardar.
  readonly #conflict = signal<{ slug: string; suggestion: string | null } | null>(null);

  readonly #normalized = computed(() => normalize(this.$draft()));
  readonly #debounced = toSignal(
    toObservable(this.#normalized).pipe(debounceTime(400), distinctUntilChanged()),
    { initialValue: '' },
  );
  readonly #isDirty = computed(() => {
    const slug = this.#normalized();
    return !!slug && slug !== normalize(this.current() ?? '');
  });

  readonly check = rxResource({
    params: () => {
      const slug = this.#debounced();
      if (!slug || slug !== this.#normalized() || !this.#isDirty()) return undefined;
      return { slug, locationId: this.locationId() ?? undefined };
    },
    stream: ({ params }) => this.#service.checkSlug(params.slug, params.locationId).pipe(toRemoteResult()),
  });

  readonly $status = computed<{ kind: 'idle' | 'checking' | 'available' | 'unavailable'; message?: string; suggestion?: string | null }>(() => {
    const slug = this.#normalized();
    if (!this.#isDirty()) return { kind: 'idle' };
    const conflict = this.#conflict();
    if (conflict?.slug === slug) return { kind: 'unavailable', message: SLUG_REASON_LABELS.taken, suggestion: conflict.suggestion };
    if (this.#debounced() !== slug || this.check.isLoading()) return { kind: 'checking' };
    const result = resultValue(this.check.value());
    if (resultError(this.check.value()) || !result || result.slug !== slug) return { kind: 'idle' };
    if (result.available) return { kind: 'available' };
    const message = result.reason ? SLUG_REASON_LABELS[result.reason] : 'No está disponible.';
    return { kind: 'unavailable', message, suggestion: result.suggestion };
  });

  readonly $canSave = computed(() => this.#isDirty() && !this.$isSaving() && this.$status().kind !== 'unavailable');

  onInput(event: Event) {
    this.$draft.set((event.target as HTMLInputElement).value);
  }

  use(suggestion: string) {
    this.$draft.set(suggestion);
  }

  save() {
    if (!this.$canSave()) return;
    const slug = this.#normalized();
    const locationId = this.locationId();
    if (locationId !== null) {
      this.#submit(slug);
      return;
    }
    // El del negocio cambia la dirección de todos los locales: se confirma.
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Cambiar la dirección del negocio',
          message: `Las cartas de todos tus locales pasarán a /carta/${slug}/… La dirección anterior seguirá funcionando y redirigirá a la nueva.`,
          confirmText: 'Cambiar',
          cancelText: 'Volver',
        },
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.#submit(slug));
  }

  #submit(slug: string) {
    const locationId = this.locationId();
    const request$ =
      locationId === null
        ? this.#service.setBusinessSlug(slug)
        : this.#service.setLocationSlug(locationId, slug).pipe(map((settings) => [settings]));
    this.$isSaving.set(true);
    request$.subscribe({
      next: (list) => {
        this.$isSaving.set(false);
        this.#conflict.set(null);
        this.#toast.show('Dirección actualizada', 'success');
        this.saved.emit(list);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const api = readApiError(error);
        if (api.code === 'SLUG_TAKEN') {
          const suggestion = typeof api.details['suggestion'] === 'string' ? (api.details['suggestion'] as string) : null;
          this.#conflict.set({ slug, suggestion });
        }
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo cambiar la dirección.'), 'error');
      },
    });
  }
}
