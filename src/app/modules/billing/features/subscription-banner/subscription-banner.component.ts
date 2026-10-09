import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { EntitlementsDto, EntitlementsService } from 'src/app/core/services/entitlements';
import { IconComponent } from 'src/ui';

const DEFAULT_TIME_ZONE = 'America/Santiago';
const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'redom.billing-banner.';

type BannerTone = 'primary' | 'warning' | 'danger';

type Banner = Readonly<{
  key: string;
  tone: BannerTone;
  icon: string;
  text: string;
  action: string | null;
  dismissible: boolean;
}>;

const TONES: Record<BannerTone, string> = {
  primary: 'border-primary/25 bg-primary/10 text-foreground',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
};

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    // Sin localStorage (modo privado): se oculta solo mientras la página siga abierta.
  }
}

function validTimeZone(zone: string | null | undefined): string {
  if (!zone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('es-CL', { timeZone: zone });
    return zone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * Avisos de la suscripción arriba del contenido: prueba, pago atrasado, plan Free y fin de la suscripción
 * (solo al dueño), y usuario en solo lectura (a cualquier rol). Nunca a SUPERADMIN.
 */
@Component({
  selector: 'app-subscription-banner',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let banners = $banners();
    @if (banners.length) {
    <div class="mb-4 flex flex-col gap-2">
      @for (banner of banners; track banner.key) {
      <div
        role="status"
        class="flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3"
        [class]="tones[banner.tone]">
        <div class="flex min-w-0 flex-1 items-start gap-2">
          <app-icon class="mt-0.5 h-5 w-5 shrink-0">{{ banner.icon }}</app-icon>
          <p class="min-w-0 font-medium">{{ banner.text }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          @if (banner.action) {
          <a
            [routerLink]="$actionLink()"
            class="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap hover:opacity-90">
            <app-icon class="h-4 w-4">workspace_premium</app-icon>
            {{ banner.action }}
          </a>
          }
          @if (banner.dismissible) {
          <button
            type="button"
            class="hover:bg-foreground/10 rounded-full p-1 opacity-70 transition hover:opacity-100"
            aria-label="Ocultar por hoy"
            title="Ocultar por hoy"
            (click)="dismiss(banner.key)">
            <app-icon class="h-4 w-4">close</app-icon>
          </button>
          }
        </div>
      </div>
      }
    </div>
    }
  `,
})
export class SubscriptionBannerComponent {
  readonly #entitlements = inject(EntitlementsService);
  readonly #settings = inject(BusinessSettingsService);

  readonly tones = TONES;
  /** El dueño va a "Mi suscripción" (ahí elige plan y paga); el resto, a la comparación de planes. */
  readonly $actionLink = computed(() => (this.#entitlements.$isOwner() ? '/billing/subscription' : '/billing/plans'));

  // Avisos ocultados en esta sesión (además de los guardados en localStorage).
  readonly #dismissed = signal<ReadonlySet<string>>(new Set());

  readonly #timeZone = computed(() => validTimeZone(this.#settings.$settings()?.timeZone));
  /** Fecha de hoy en la zona del negocio (YYYY-MM-DD): los avisos se ocultan por día. */
  readonly #today = computed(() => new Intl.DateTimeFormat('en-CA', { timeZone: this.#timeZone() }).format(new Date()));

  readonly $banners = computed<Banner[]>(() => {
    if (this.#entitlements.$isSuperAdmin()) return [];
    const banners: Banner[] = [];

    if (this.#entitlements.$currentUserLocked()) {
      banners.push({
        key: 'user-locked',
        tone: 'warning',
        icon: 'visibility',
        text: 'Tu usuario está en solo lectura porque el negocio superó los usuarios de su plan. Pide al dueño que libere un cupo o mejore el plan.',
        action: null,
        dismissible: false,
      });
    }

    const value = this.#entitlements.$entitlements();
    if (value && this.#entitlements.$isOwner()) banners.push(...this.#ownerBanners(value));

    const dismissed = this.#dismissed();
    const today = this.#today();
    return banners.filter((banner) => !banner.dismissible || (!dismissed.has(banner.key) && readStorage(banner.key) !== today));
  });

  dismiss(key: string) {
    writeStorage(key, this.#today());
    this.#dismissed.update((keys) => new Set([...keys, key]));
  }

  #ownerBanners(value: EntitlementsDto): Banner[] {
    const banners: Banner[] = [];
    const now = Date.now();
    const trialEnd = value.trialEndsAt ? new Date(value.trialEndsAt).getTime() : NaN;
    const trialActive = value.status === 'trialing' && Number.isFinite(trialEnd) && trialEnd > now;
    const trialOver = value.status === 'trialing' && Number.isFinite(trialEnd) && trialEnd <= now;

    if (value.status === 'past_due') {
      const grace = this.#formatDate(value.graceEndsAt);
      banners.push({
        key: 'past-due',
        tone: 'danger',
        icon: 'error',
        text: grace
          ? `Tu pago está atrasado. Paga antes del ${grace} para no perder las funciones de tu plan.`
          : 'Tu pago está atrasado. Paga pronto para no perder las funciones de tu plan.',
        action: 'Pagar',
        dismissible: false,
      });
    } else if (value.plan.code === 'free' && (value.status === 'expired' || value.status === 'cancelled' || trialOver)) {
      banners.push({
        key: 'free',
        tone: 'primary',
        icon: 'inventory_2',
        text: 'Estás en el plan Free. Tus datos están guardados: mejora tu plan para volver a usar todas las funciones.',
        action: 'Ver planes',
        dismissible: true,
      });
    } else if (trialActive) {
      const days = Math.max(1, Math.ceil((trialEnd - now) / DAY_MS));
      banners.push({
        key: 'trial',
        tone: days <= 3 ? 'warning' : 'primary',
        icon: 'hourglass_top',
        text: `Prueba del plan ${value.plan.name}: ${days === 1 ? 'te queda 1 día' : `te quedan ${days} días`}`,
        action: 'Elegir plan',
        dismissible: true,
      });
    }

    const periodEnd = this.#formatDate(value.currentPeriodEnd);
    if (value.cancelAtPeriodEnd && periodEnd && value.status !== 'expired' && value.status !== 'cancelled') {
      banners.push({
        key: 'cancel-at-period-end',
        tone: 'warning',
        icon: 'event_busy',
        text: `Tu suscripción termina el ${periodEnd}.`,
        action: 'Ver planes',
        dismissible: true,
      });
    }
    return banners;
  }

  #formatDate(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: this.#timeZone() });
  }
}
