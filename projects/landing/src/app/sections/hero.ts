import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../ui/icon';
import { APP_LINKS } from '../ui/links';

@Component({
  selector: 'lnd-hero',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="inicio" class="lnd-on-brand relative isolate overflow-hidden pt-16 text-white lg:flex lg:min-h-dvh lg:items-center">
      <!-- Fondo de marca (igual al login). La máscara lo desvanece hacia abajo y deja ver el fondo vivo, sin corte. -->
      <div class="lnd-hero-bg bg-primary absolute inset-0 -z-10" aria-hidden="true">
        <div class="lnd-lines absolute"></div>
        <div class="lnd-shade absolute inset-0"></div>
        <span class="lnd-blob lnd-blob--a"></span>
        <span class="lnd-blob lnd-blob--b"></span>
      </div>

      <div class="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-36 pt-16 sm:px-6 sm:pb-40 sm:pt-24 lg:grid-cols-2 lg:pb-44 lg:pt-20">
        <div class="text-center lg:text-left">
          <p class="lnd-chip mx-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium lg:mx-0">
            <span class="size-1.5 rounded-full bg-white"></span> Software para restaurantes
          </p>
          <h1 class="mt-5 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">Tu restaurante, en un solo lugar.</h1>
          <p class="mx-auto mt-5 max-w-xl text-base font-light text-white/85 sm:text-lg lg:mx-0">
            Toma pedidos, coordina la cocina, cuadra la caja, controla tu inventario y tus gastos, y revisa tus ventas. Todo desde el navegador, sin instalar nada.
          </p>
          <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <a [href]="app.signUp" class="text-primary inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-semibold shadow-lg transition hover:bg-white/90 sm:w-auto">
              Crear cuenta <lnd-icon name="arrow" class="size-4" />
            </a>
            <a [href]="app.signIn" class="lnd-chip inline-flex w-full items-center justify-center rounded-full px-6 py-3 font-semibold transition hover:bg-white/20 sm:w-auto">
              Ya tengo cuenta
            </a>
          </div>
          <ul class="mt-8 flex flex-wrap justify-center gap-2 text-xs sm:text-sm lg:justify-start">
            @for (chip of chips; track chip) {
            <li class="lnd-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"><lnd-icon name="check" class="size-4" />{{ chip }}</li>
            }
          </ul>
        </div>

        <!-- Ilustración de la app (no son datos reales) -->
        <div class="lnd-glass mx-auto w-full max-w-md rounded-[1.75rem] p-5 sm:p-6" aria-hidden="true">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold">Salón principal</p>
            <span class="lnd-chip rounded-full px-2.5 py-0.5 text-xs">En servicio</span>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2.5">
            @for (table of tables; track table.name) {
            <div class="rounded-xl p-3 text-center text-xs" [class]="table.busy ? 'bg-white text-primary' : 'lnd-chip'">
              <p class="font-semibold">{{ table.name }}</p>
              <p class="mt-0.5 opacity-80">{{ table.busy ? 'Ocupada' : 'Libre' }}</p>
            </div>
            }
          </div>
          <div class="mt-4 space-y-2">
            @for (line of tickets; track line.item) {
            <div class="lnd-chip flex items-center justify-between rounded-xl px-3 py-2 text-xs">
              <span><strong class="font-semibold">{{ line.qty }}×</strong> {{ line.item }} @if (line.note) { <em class="text-white/75">· {{ line.note }}</em> }</span>
              <span class="rounded-full bg-white/20 px-2 py-0.5">{{ line.station }}</span>
            </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class Hero {
  protected readonly app = APP_LINKS;
  protected readonly chips = ['POS y mesas', 'Cocina en pantalla', 'Caja e inventario', 'Asistente con IA'];
  protected readonly tables = [
    { name: 'Mesa 1', busy: true },
    { name: 'Mesa 2', busy: false },
    { name: 'Mesa 3', busy: true },
    { name: 'Mesa 4', busy: false },
    { name: 'Terraza', busy: true },
    { name: 'Barra', busy: false },
  ];
  protected readonly tickets = [
    { qty: 2, item: 'Completo italiano', note: 'sin palta', station: 'Cocina' },
    { qty: 1, item: 'Limonada menta', note: '', station: 'Bar' },
  ];
}
