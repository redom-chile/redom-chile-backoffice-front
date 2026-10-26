import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from 'src/ui';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { LegalSessionStore } from 'src/app/core/services/legal/legal-session.store';

// Después de cualquier login (o de aceptar los documentos legales): whoami decide si va al onboarding (sin negocio) o a la app.
@Injectable({ providedIn: 'root' })
export class PostLoginService {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly whoami = inject(WhoamiService);
  private readonly legal = inject(LegalSessionStore);

  continue(name?: string | null, isNewUser = false) {
    // Documentos legales por aceptar: la sesión solo sirve para eso hasta aceptarlos.
    if (this.legal.$restricted()) {
      this.router.navigateByUrl('/legal/accept');
      return;
    }
    this.whoami.homeRoute().subscribe((route) => {
      const target = isNewUser ? '/onboarding' : route;
      if (name) this.toast.show(target === '/onboarding' ? `¡Hola, ${name}! Creemos tu negocio.` : `¡Bienvenido, ${name}!`, 'success');
      this.router.navigateByUrl(target);
    });
  }
}
