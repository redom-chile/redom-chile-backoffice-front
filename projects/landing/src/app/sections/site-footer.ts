import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RedomLogoComponent } from 'src/ui/atoms/redom-logo/redom-logo.component';
import { Icon } from '../ui/icon';
import { APP_LINKS } from '../ui/links';

@Component({
  selector: 'lnd-site-footer',
  imports: [Icon, RedomLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="px-4 pb-20 sm:px-6" aria-labelledby="cta-title">
      <div class="lnd-on-brand bg-primary relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-14 text-center text-white sm:px-12">
        <div class="lnd-lines absolute -z-10 opacity-60" aria-hidden="true"></div>
        <div class="lnd-shade absolute inset-0 -z-10" aria-hidden="true"></div>
        <h2 id="cta-title" class="text-3xl font-semibold sm:text-4xl">¿Listo para ordenar tu restaurante?</h2>
        <p class="mx-auto mt-3 max-w-xl text-white/85">Crea tu cuenta y configura tu negocio hoy mismo.</p>
        <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a [href]="app.signUp" class="text-primary inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-semibold shadow-lg transition hover:bg-white/90 sm:w-auto">
            Crear cuenta <lnd-icon name="arrow" class="size-4" />
          </a>
          <a [href]="app.signIn" class="lnd-chip inline-flex w-full items-center justify-center rounded-full px-6 py-3 font-semibold sm:w-auto">Ingresar</a>
        </div>
      </div>
    </section>

    <footer class="border-t border-border">
      <div class="text-muted-foreground mx-auto max-w-6xl px-4 py-10 text-sm sm:px-6">
        <!-- Celular: todo centrado y apilado. Desde md: marca a la izquierda y enlaces a la derecha. -->
        <div class="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
          <div class="flex flex-col items-center gap-2 md:items-start">
            <app-redom-logo class="h-5" />
            <p>Todo tu restaurante, en una vuelta.</p>
          </div>
          <nav aria-label="Pie de página" class="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="#funciones" class="hover:text-foreground">Funciones</a>
            <a href="#preguntas" class="hover:text-foreground">Preguntas</a>
            <a [href]="app.signIn" class="hover:text-foreground">Ingresar</a>
          </nav>
        </div>
        <p class="border-border/60 mt-8 border-t pt-6 text-center text-xs md:text-left">© {{ year }} Redom. Hecho en Chile.</p>
      </div>
    </footer>
  `,
})
export class SiteFooter {
  protected readonly app = APP_LINKS;
  protected readonly year = new Date().getFullYear();
}
