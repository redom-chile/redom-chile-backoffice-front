import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService, PlanUpsellService, PublicPlansService } from 'src/app/core/services/entitlements';
import { EXTRA_MENU_LANGUAGES, ExtraMenuLanguage, getPublicMenuErrorMessage, MenuSettingsDto, MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { LANGUAGE_LABELS } from 'src/app/modules/public-menu/features/menu-translation-shared';
import { ButtonComponent, IconComponent, ToastService } from 'src/ui';

/** Sección "Idiomas de la carta" de la tarjeta del local (plan menu_translations). Guarda al marcar, con rollback. */
@Component({
  selector: 'app-menu-translation-languages',
  imports: [RouterLink, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let editable = $canEdit() && $hasFeature();
    @let selected = $languages();
    <div class="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-foreground font-semibold">Idiomas de la carta</h3>
        @if (!$hasFeature()) {
        <span class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
          <app-icon class="h-3.5 w-3.5" aria-hidden="true">lock</app-icon>{{ $planBadge() }}
        </span>
        }
      </div>

      @if (!$hasFeature()) {
      <div class="glass-row flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-muted-foreground text-sm">Muestra tu carta en inglés, portugués o alemán para tus clientes extranjeros.</p>
        <app-button impact="light" size="small" type="button" icon="workspace_premium" (buttonClick)="upsell()">Ver planes</app-button>
      </div>
      }

      <div class="glass-row flex flex-col gap-3 rounded-xl p-3">
        <p class="text-muted-foreground text-xs">
          Español siempre está incluido. Tus clientes eligen el idioma en la carta; lo que no esté traducido se ve en español.
        </p>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Idiomas de la carta">
          <span class="bg-muted/40 text-muted-foreground inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium" title="Siempre incluido">
            <span aria-hidden="true">🇪🇸</span>Español
            <app-icon class="h-4 w-4" aria-hidden="true">check</app-icon>
          </span>
          @for (language of languages; track language) {
          @let label = labels[language];
          @let checked = selected.includes(language);
          <label
            class="inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors"
            [class]="checked ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground border-[var(--border)]'"
            [class.cursor-pointer]="editable && !$busy()"
            [class.opacity-60]="!editable">
            <input
              type="checkbox"
              class="accent-[var(--primary)] h-4 w-4"
              [checked]="checked"
              [disabled]="!editable || $busy()"
              (change)="toggle(language, $any($event.target).checked)" />
            <span aria-hidden="true">{{ label.flag }}</span>{{ label.name }}
          </label>
          }
        </div>
        @if ($hasFeature() && selected.length) {
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          @for (language of selected; track language) {
          <a
            routerLink="/settings/menu-translations"
            [queryParams]="{ language }"
            class="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline">
            <app-icon class="h-4 w-4" aria-hidden="true">translate</app-icon>Traducir textos ({{ labels[language].name }})
          </a>
          }
        </div>
        }
      </div>
    </div>
  `,
})
export class MenuTranslationLanguagesComponent {
  readonly #service = inject(MenuSettingsService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #plans = inject(PublicPlansService);
  readonly #upsell = inject(PlanUpsellService);

  readonly languages = EXTRA_MENU_LANGUAGES;
  readonly labels = LANGUAGE_LABELS;

  readonly settings = input.required<MenuSettingsDto>();
  readonly changed = output<MenuSettingsDto[]>();

  readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS));
  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('menu_translations'));
  readonly $planBadge = computed(() => {
    const name = this.#plans.planName(this.#plans.firstPlanWith(['menu_translations'])?.code);
    return name ? `Plan ${name}` : 'No incluido';
  });

  readonly $languages = linkedSignal<ExtraMenuLanguage[]>(() => this.#ordered(this.settings().languages ?? []));
  readonly $busy = signal(false);

  toggle(language: ExtraMenuLanguage, checked: boolean) {
    if (this.$busy()) return;
    const previous = this.$languages();
    const next = this.#ordered(checked ? [...previous, language] : previous.filter((item) => item !== language));
    this.$languages.set(next);
    this.$busy.set(true);
    this.#service.update(this.settings().locationId, { languages: next }).subscribe({
      next: (settings) => {
        this.$busy.set(false);
        const name = LANGUAGE_LABELS[language].name.toLowerCase();
        this.#toast.show(checked ? `La carta ya se ofrece en ${name}` : `La carta dejó de ofrecerse en ${name}`, 'success');
        this.changed.emit([settings]);
      },
      error: (error: unknown) => {
        this.$busy.set(false);
        this.$languages.set(previous);
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudieron guardar los idiomas.'), 'error');
      },
    });
  }

  upsell() {
    this.#upsell.open({ features: ['menu_translations'] });
  }

  #ordered(list: readonly ExtraMenuLanguage[]): ExtraMenuLanguage[] {
    return EXTRA_MENU_LANGUAGES.filter((language) => list.includes(language));
  }
}
