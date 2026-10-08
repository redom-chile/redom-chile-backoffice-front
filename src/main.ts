import { enableProdMode, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';

import { environment } from './environments/environment';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthInterceptor } from './app/core/interceptor';
import { planErrorInterceptor } from './app/core/services/entitlements';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { OVERLAY_DEFAULT_CONFIG } from '@angular/cdk/overlay';

if (environment.production) {
  enableProdMode();
  if (window) {
    selfXSSWarning();
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withXhr(), withInterceptors([AuthInterceptor, planErrorInterceptor])),
    importProvidersFrom(AngularSvgIconModule.forRoot()),
    // Los overlays del CDK usan la top layer nativa (popover) por defecto, que queda sobre cualquier z-index.
    // Se desactiva para que el toast global (z-[9999]) se muestre encima de los modales.
    { provide: OVERLAY_DEFAULT_CONFIG, useValue: { usePopover: false } },
  ],
})
  .then(() => hideBootScreen())
  .catch((err) => console.error(err));

/** Desvanece la pantalla de carga de index.html, dejándola visible al menos BOOT_MIN_MS desde que abrió la página. */
function hideBootScreen() {
  const BOOT_MIN_MS = 1000;
  const boot = document.querySelector<HTMLElement>('.redom-boot');
  if (!boot) return;
  setTimeout(() => {
    boot.classList.add('is-done');
    boot.addEventListener('transitionend', () => boot.remove(), { once: true });
    setTimeout(() => boot.remove(), 600); // por si no hay transición (movimiento reducido, pestaña oculta)
  }, Math.max(0, BOOT_MIN_MS - performance.now()));
}

function selfXSSWarning() {
  setTimeout(() => {
    console.log(
      '%c** STOP **',
      'font-weight:bold; font: 2.5em Arial; color: white; background-color: #e11d48; padding-left: 15px; padding-right: 15px; border-radius: 25px; padding-top: 5px; padding-bottom: 5px;',
    );
    console.log(
      `\n%cThis is a browser feature intended for developers. Using this console may allow attackers to impersonate you and steal your information sing an attack called Self-XSS. Do not enter or paste code that you do not understand.`,
      'font-weight:bold; font: 2em Arial; color: #e11d48;',
    );
  });
}
