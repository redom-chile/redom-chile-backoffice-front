import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import {
  EntitlementsService,
  PLAN_FEATURE_LABELS,
  PLAN_LIMIT_LABELS,
  PlanUpsellData,
  PublicPlansService,
} from 'src/app/core/services/entitlements';
import { IconComponent } from 'src/ui';

/** "Disponible desde el plan X": función no incluida, límite lleno o recurso en solo lectura. */
@Component({
  selector: 'app-plan-upsell-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-4 p-6 text-center">
      <span class="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full">
        <app-icon class="h-7 w-7">{{ data.limit || data.resource ? 'trending_up' : 'lock' }}</app-icon>
      </span>
      <div>
        <h2 class="text-foreground text-lg font-semibold">{{ $title() }}</h2>
        <p class="text-muted-foreground mt-2 text-sm">{{ $message() }}</p>
      </div>

      @if ($planName(); as planName) {
      <p class="bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold">Disponible desde el plan {{ planName }}</p>
      }
      @if (data.resource) {
      <p class="text-muted-foreground text-xs">No se borró nada: tus datos siguen guardados y puedes verlos.</p>
      }

      <div class="mt-2 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <button type="button" class="glass-row rounded-full px-5 py-2.5 text-sm font-medium" (click)="dialogRef.close()">Ahora no</button>
        <button
          type="button"
          class="bg-primary text-primary-foreground inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90"
          (click)="handlePlans()">
          <app-icon class="h-5 w-5">workspace_premium</app-icon>Ver planes
        </button>
      </div>
      @if (!$isOwner()) {
      <p class="text-muted-foreground text-xs">Pídele al dueño del negocio que mejore el plan.</p>
      }
    </div>
  `,
})
export class PlanUpsellModalComponent {
  readonly data = inject<PlanUpsellData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<PlanUpsellModalComponent>);
  readonly #router = inject(Router);
  readonly #plans = inject(PublicPlansService);
  readonly #entitlements = inject(EntitlementsService);

  readonly $isOwner = this.#entitlements.$isOwner;

  readonly $planName = computed(() => {
    const required = this.data.requiredPlans?.[0];
    if (required) return this.#plans.planName(required);
    if (this.data.features?.length) return this.#plans.firstPlanWith(this.data.features)?.name ?? null;
    return null;
  });

  readonly $title = computed(() => {
    const { features, limit, resource } = this.data;
    if (resource === 'users') return 'Tu usuario está en solo lectura';
    if (resource) return resource === 'locations' ? 'Este local está en solo lectura' : 'Esta caja está en solo lectura';
    if (limit) return `Llegaste al límite de ${PLAN_LIMIT_LABELS[limit].many}`;
    if (features?.length) return features.map((code) => PLAN_FEATURE_LABELS[code] ?? code).join(' + ');
    return 'Mejora tu plan';
  });

  readonly $message = computed(() => {
    const { features, limit, max, resource } = this.data;
    if (resource === 'users') return 'El negocio superó los usuarios de su plan. Pide al dueño que libere un cupo o mejore el plan.';
    if (resource) {
      const name = resource === 'locations' ? 'locales' : 'cajas';
      return `El negocio tiene más ${name} activos que los que permite su plan. Desactiva los que no uses o mejora tu plan.`;
    }
    if (limit) {
      const label = PLAN_LIMIT_LABELS[limit];
      const amount = max ?? this.#entitlements.limitOf(limit);
      return amount === null || amount === undefined
        ? `Tu plan no permite agregar más ${label.many}.`
        : `Tu plan permite ${amount} ${amount === 1 ? label.one : label.many}. Para agregar más, mejora tu plan.`;
    }
    if (features?.length) return 'Tu plan actual no incluye esta función. Mejora tu plan para usarla.';
    return 'Mejora tu plan para usar más funciones.';
  });

  handlePlans() {
    this.dialogRef.close();
    // El dueño va a "Mi suscripción" (ahí elige plan y paga); el resto, a la comparación de planes.
    this.#router.navigateByUrl(this.$isOwner() ? '/billing/subscription' : '/billing/plans');
  }
}
