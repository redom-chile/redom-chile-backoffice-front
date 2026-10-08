import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, linkedSignal, output, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { PLAN_FEATURE_LABELS, PlanFeatureCode } from 'src/app/core/services/entitlements';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { getPlatformErrorMessage, PlatformPlanDto, PlatformService } from '../../data-access';
import { confirmPlanAction, planImpactMessage } from '../plan-shared';

/** Pestaña "Funciones": checkboxes del catálogo (reemplaza todas las funciones del plan). */
@Component({
  selector: 'app-plan-features-form',
  imports: [ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass overflow-hidden rounded-[1rem]">
      @if (catalog.isLoading() && !$features().length) {
      <div class="divide-y divide-[var(--border)]">
        @for (row of [1, 2, 3, 4, 5]; track row) {
        <div class="flex items-center gap-3 px-4 py-4">
          <app-skeleton size="xs" style="width: 20px" />
          <app-skeleton size="xs" style="width: 220px" />
        </div>
        }
      </div>
      } @else if ($error(); as error) {
      <div class="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <p class="text-foreground font-medium">No se pudo cargar el catálogo de funciones</p>
        <p class="text-muted-foreground text-sm">{{ errorMessage(error) }}</p>
        <app-button type="button" impact="bold" (buttonClick)="catalog.reload()">Reintentar</app-button>
      </div>
      } @else {
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <p class="text-muted-foreground text-sm">{{ $selected().size }} de {{ $features().length }} funciones incluidas</p>
        <div class="flex gap-3 text-sm font-medium">
          <button type="button" class="text-primary hover:underline" (click)="setAll(true)">Marcar todas</button>
          <button type="button" class="text-primary hover:underline" (click)="setAll(false)">Quitar todas</button>
        </div>
      </div>
      <ul class="divide-y divide-[var(--border)]">
        @for (feature of $features(); track feature.code) {
        <li>
          <label class="glass-row flex cursor-pointer items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              class="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
              [checked]="$selected().has(feature.code)"
              (change)="toggle(feature.code)" />
            <span class="min-w-0 flex-1">
              <span class="text-foreground block text-sm font-medium">
                {{ feature.name || featureLabel(feature.code) }}
                <span class="text-muted-foreground ml-1 font-mono text-xs font-normal">{{ feature.code }}</span>
              </span>
              @if (feature.description) {
              <span class="text-muted-foreground block text-xs">{{ feature.description }}</span>
              }
              <span class="text-muted-foreground mt-1 block text-xs">
                @if (feature.otherPlans.length) {
                También en: {{ feature.otherPlans.join(', ') }}
                } @else {
                Ningún otro plan la incluye
                }
              </span>
            </span>
          </label>
        </li>
        }
      </ul>
      <div class="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <app-icon class="h-4 w-4">bolt</app-icon>
          Los cambios aplican al instante a los negocios del plan.
        </p>
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving() || !$isDirty()" (buttonClick)="reset()">Descartar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving() || !$isDirty()" [isLoading]="$isSaving()" (buttonClick)="handleSave()">
            Guardar
          </app-button>
        </div>
      </div>
      }
    </div>
  `,
})
export class PlanFeaturesFormComponent {
  readonly $plan = input.required<PlatformPlanDto>({ alias: 'plan' });
  /** Todos los planes, para mostrar el nombre de los otros que incluyen cada función. */
  readonly $plans = input<PlatformPlanDto[]>([], { alias: 'plans' });
  readonly saved = output<PlatformPlanDto>();

  readonly #platform = inject(PlatformService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly catalog = rxResource({ stream: () => this.#platform.getFeatures().pipe(toRemoteResult()) });
  readonly $error = computed(() => resultError(this.catalog.value()));
  readonly $features = computed(() => {
    const plan = this.$plan();
    const names = new Map(this.$plans().map((item) => [item.code, item.name]));
    return [...(resultValue(this.catalog.value()) ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((feature) => ({
        ...feature,
        otherPlans: feature.plans.filter((code) => code !== plan.code).map((code) => names.get(code) ?? code),
      }));
  });
  readonly $selected = linkedSignal(() => new Set<PlanFeatureCode>(this.$plan().features));
  readonly $isDirty = computed(() => {
    const selected = this.$selected();
    const current = this.$plan().features;
    return selected.size !== current.length || current.some((code) => !selected.has(code));
  });
  readonly $isSaving = signal(false);

  errorMessage(error: unknown): string {
    return getPlatformErrorMessage(error, 'Intenta nuevamente.');
  }

  featureLabel(code: PlanFeatureCode): string {
    return PLAN_FEATURE_LABELS[code] ?? code;
  }

  toggle(code: PlanFeatureCode) {
    this.$selected.update((selected) => {
      const next = new Set(selected);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  setAll(checked: boolean) {
    this.$selected.set(new Set(checked ? this.$features().map((feature) => feature.code) : []));
  }

  reset() {
    this.$selected.set(new Set(this.$plan().features));
  }

  handleSave() {
    if (this.$isSaving() || !this.$isDirty()) return;
    const plan = this.$plan();
    // Orden del catálogo para que el historial quede legible.
    const featureCodes = this.$features()
      .map((feature) => feature.code)
      .filter((code) => this.$selected().has(code));
    confirmPlanAction(this.#dialog, {
      title: 'Guardar funciones',
      message: `${planImpactMessage(plan.subscriptions)} El plan quedará con ${featureCodes.length} ${featureCodes.length === 1 ? 'función' : 'funciones'}.`,
      confirmText: 'Guardar',
      cancelText: 'Volver',
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.$isSaving.set(true);
      this.#platform
        .setPlanFeatures(plan.id, featureCodes)
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe({
          next: (updated) => {
            this.$isSaving.set(false);
            this.#toast.show('Funciones guardadas', 'success');
            this.saved.emit(updated);
            this.catalog.reload();
          },
          error: (error: unknown) => {
            this.$isSaving.set(false);
            this.#toast.show(getPlatformErrorMessage(error, 'No se pudieron guardar las funciones'), 'error');
          },
        });
    });
  }
}
