import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService, MenuSortMode, SettingNotSupportedError } from 'src/app/core/services/business-settings';
import { IconComponent, ToastService } from 'src/ui';

const OPTIONS: ReadonlyArray<{ value: MenuSortMode; label: string; icon: string }> = [
  { value: 'manual', label: 'Manual', icon: 'drag_indicator' },
  { value: 'alphabetical', label: 'Alfabético', icon: 'sort_by_alpha' },
];

/** "Orden de la carta": ajuste del negocio que usan la carta pública, el POS y estas listas. */
@Component({
  selector: 'app-menu-sort-mode-control',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span id="menu-sort-mode-label" class="text-foreground text-sm font-medium">Orden de la carta</span>
      <div
        role="radiogroup"
        aria-labelledby="menu-sort-mode-label"
        class="glass inline-flex w-full rounded-full p-1 sm:w-auto"
        [class.opacity-60]="!$canEdit()">
        @for (option of options; track option.value) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="$mode() === option.value"
          [disabled]="!$canEdit() || $saving()"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none"
          [class]="$mode() === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
          (click)="select(option.value)">
          <app-icon class="h-4 w-4" aria-hidden="true">{{ option.icon }}</app-icon>{{ option.label }}
        </button>
        }
      </div>
      <p class="text-muted-foreground text-xs">
        {{ $mode() === 'manual' ? 'Arrastra las filas para elegir el orden.' : 'Se ordena por nombre.' }}
        @if (!$canEdit()) { Solo quien administra el negocio puede cambiarlo. }
      </p>
    </div>
  `,
})
export class MenuSortModeControlComponent {
  readonly #settings = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  protected readonly options = OPTIONS;
  protected readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.BUSINESS.UPDATE_SETTINGS));
  // Optimista: cambia al tiro y vuelve al valor guardado si falla.
  protected readonly $mode = linkedSignal(() => this.#settings.$menuSortMode());
  protected readonly $saving = signal(false);

  select(mode: MenuSortMode) {
    if (mode === this.$mode() || this.$saving() || !this.$canEdit()) return;
    const previous = this.$mode();
    this.$mode.set(mode);
    this.$saving.set(true);
    this.#settings.updateMenuSortMode(mode).subscribe({
      next: () => {
        this.$saving.set(false);
        this.#toast.show(mode === 'manual' ? 'La carta usa tu orden manual' : 'La carta se ordena por nombre', 'success');
      },
      error: (error) => {
        this.$saving.set(false);
        this.$mode.set(previous);
        this.#toast.show(
          error instanceof SettingNotSupportedError
            ? 'El servidor no guardó el orden de la carta. Intenta nuevamente.'
            : error instanceof HttpErrorResponse && error.status === HttpStatusCode.Forbidden
              ? 'No tienes permiso para cambiar el orden de la carta.'
              : 'No se pudo cambiar el orden de la carta. Intenta nuevamente.',
          'error',
        );
      },
    });
  }
}
