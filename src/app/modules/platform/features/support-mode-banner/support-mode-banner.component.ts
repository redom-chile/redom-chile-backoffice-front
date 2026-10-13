import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SupportModeService } from 'src/app/core/services/support-mode';
import { IconComponent } from 'src/ui';
import { formatPlatformDate } from '../../data-access';

/** Barra fija mientras el SUPERADMIN está en modo soporte (#50). */
@Component({
  selector: 'app-support-mode-banner',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ($session(); as session) {
      <div
        role="status"
        class="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex flex-col gap-2 border-b border-amber-600/40 bg-amber-400 px-4 py-2.5 text-amber-950 shadow-sm sm:-mx-8 sm:flex-row sm:items-center sm:px-8 dark:bg-amber-500 dark:text-amber-950">
        <app-icon class="hidden h-6 w-6 shrink-0 sm:block" aria-hidden="true">support_agent</app-icon>
        <div class="min-w-0 flex-1 text-sm">
          <p class="font-semibold break-words">Modo soporte: {{ session.businessName }} · hasta {{ $expiresAt() }}</p>
          <p class="text-xs opacity-90">Solo puedes gestionar la carta</p>
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center justify-center gap-1 self-start rounded-md bg-amber-950 px-3 py-1.5 text-sm font-semibold text-amber-50 transition hover:opacity-90 sm:self-auto"
          (click)="exit()">
          <app-icon class="h-4 w-4" aria-hidden="true">logout</app-icon>
          Salir
        </button>
      </div>
    }
  `,
})
export class SupportModeBannerComponent {
  readonly #support = inject(SupportModeService);
  readonly $session = this.#support.$session;
  readonly $expiresAt = computed(() => formatPlatformDate(this.$session()?.expiresAt, true));

  exit() {
    this.#support.exit();
  }
}
