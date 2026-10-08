import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../ui/icon';

@Component({
  selector: 'lnd-faq',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="preguntas" class="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="faq-title">
      <div class="text-center">
        <p class="text-primary text-sm font-semibold uppercase tracking-wider">Preguntas frecuentes</p>
        <h2 id="faq-title" class="mt-2 text-3xl font-semibold sm:text-4xl">¿Tienes dudas?</h2>
      </div>

      <div class="mt-12 space-y-3">
        @for (item of faqs; track item.q) {
        <details class="lnd-card group rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
            {{ item.q }}
            <lnd-icon name="plus" class="text-primary size-5 transition-transform group-open:rotate-45" />
          </summary>
          <p class="text-muted-foreground mt-3 text-sm leading-relaxed">{{ item.a }}</p>
        </details>
        }
      </div>
    </section>
  `,
})
export class Faq {
  protected readonly faqs = [
    { q: '¿Tengo que instalar algo?', a: 'No. Redom funciona en el navegador. Para imprimir comandas basta con dejar abierta la estación de impresión en un equipo del local.' },
    { q: '¿Funciona en tablet o celular?', a: 'Sí. El POS y la pantalla de cocina están pensados para pantallas táctiles, y el resto de la app se adapta al celular.' },
    { q: '¿Puedo manejar varias sucursales?', a: 'Sí. Creas tus sucursales dentro del mismo negocio y cada una tiene sus propias mesas, estaciones y equipo.' },
    { q: '¿Cómo entran los meseros?', a: 'Los invitas desde la app con su rol. En el POS del salón entran eligiendo su nombre y su PIN de 4 dígitos.' },
    { q: '¿Me ayuda a cuadrar la caja y llevar los gastos?', a: 'Sí. Abres y cierras la caja por turno con arqueo de billetes y monedas, y registras gastos y cuentas por pagar. Lo que pagas en efectivo sale solo de la caja.' },
    { q: '¿Puedo controlar el inventario y el costo de mis platos?', a: 'Sí. Registras compras y stock por local, y con las recetas Redom descuenta los ingredientes al vender y te muestra el food cost de cada plato.' },
    { q: '¿Qué hace el asistente con IA?', a: 'Responde tus dudas sobre cómo usar Redom en lenguaje natural, desde cualquier pantalla. Se basa en las guías del centro de ayuda y te muestra cuáles usó, para que puedas revisarlas.' },
    { q: '¿Puedo entrar con mi cuenta de Google?', a: 'Sí. Puedes registrarte e ingresar con Google o con tu email y contraseña.' },
  ];
}
