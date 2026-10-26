import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, PostLoginService } from 'src/app/modules/auth/pages/data-access';
import { RedomLogoComponent, ToastService } from 'src/ui';
import { LegalAcceptPanelComponent, LegalAcceptResult } from '../../features';

/**
 * "Antes de seguir": la sesión del login quedó restringida porque faltan documentos legales. Al aceptarlos el backend
 * entrega la sesión normal, que reemplaza a la restringida, y recién ahí se carga la app.
 */
@Component({
  selector: 'app-legal-accept-page',
  imports: [RedomLogoComponent, LegalAcceptPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-screen min-h-dvh relative overflow-x-hidden">
      <div class="bg-primary fixed inset-0" aria-hidden="true"></div>
      <div class="auth-shade fixed inset-0" aria-hidden="true"></div>
      <main class="auth-safe min-h-dvh relative flex flex-col items-center justify-center gap-6 px-4 py-10">
        <app-redom-logo glass class="[--redom-logo-size:2.25rem]" />
        <section
          class="auth-card w-full max-w-lg rounded-[1.75rem] px-5 py-8 sm:px-8"
          aria-labelledby="legal-accept-title">
          <h1 id="legal-accept-title" class="text-foreground text-2xl font-semibold">Antes de seguir</h1>
          <p class="text-muted-foreground mt-1 mb-5 text-sm">
            Para usar Redom necesitamos que leas y aceptes estos documentos. Puedes abrir cada uno antes de marcarlo.
          </p>
          <app-legal-accept-panel (done)="onDone($event)" />
        </section>
      </main>
    </div>
  `,
})
export class LegalAcceptPage {
  readonly #auth = inject(AuthService);
  readonly #postLogin = inject(PostLoginService);
  readonly #toast = inject(ToastService);
  readonly #router = inject(Router);

  onDone(result: LegalAcceptResult) {
    // Con la sesión restringida llega la normal: el token anterior deja de servir.
    if (result.session) this.#auth.startSession(result.session);
    else if (this.#auth.isRestricted()) {
      // Sin sesión nueva no hay con qué seguir: se vuelve a iniciar sesión.
      this.#toast.show('Inicia sesión de nuevo para continuar.', 'warning');
      this.#auth.clearSession();
      this.#router.navigateByUrl('/auth/sign-in');
      return;
    }
    this.#toast.show('¡Listo! Gracias por aceptar.', 'success');
    this.#postLogin.continue(result.session?.userData.name);
  }
}
