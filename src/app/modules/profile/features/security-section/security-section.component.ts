import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent, IconComponent } from 'src/ui';

@Component({
  selector: 'app-security-section',
  imports: [ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass rounded-2xl p-5 sm:p-6" aria-labelledby="security-title">
      <header class="mb-4">
        <h3 id="security-title" class="text-foreground text-base font-semibold">Seguridad y sesión</h3>
        <p class="text-muted-foreground text-xs">Protege el acceso a tu cuenta.</p>
      </header>

      <div class="divide-border divide-y divide-dashed">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg" aria-hidden="true">
              <app-icon class="h-4.5 w-4.5">lock</app-icon>
            </span>
            <div class="min-w-0">
              <p class="text-foreground text-sm font-medium">Contraseña</p>
              <p class="text-muted-foreground text-xs">Cámbiala si crees que alguien más la conoce.</p>
            </div>
          </div>
          <app-button impact="light" tone="primary" size="small" type="button" (buttonClick)="changePassword.emit()">
            Cambiar contraseña
          </app-button>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600" aria-hidden="true">
              <app-icon class="h-4.5 w-4.5">logout</app-icon>
            </span>
            <div class="min-w-0">
              <p class="text-foreground text-sm font-medium">Cerrar sesión</p>
              <p class="text-muted-foreground text-xs">Sal de tu cuenta en este dispositivo.</p>
            </div>
          </div>
          <app-button impact="light" tone="danger" size="small" type="button" [disabled]="loggingOut()" [isLoading]="loggingOut()" (buttonClick)="logout.emit()">
            Cerrar sesión
          </app-button>
        </div>
      </div>
    </section>
  `,
})
export class SecuritySectionComponent {
  readonly loggingOut = input(false);
  readonly changePassword = output<void>();
  readonly logout = output<void>();
}
