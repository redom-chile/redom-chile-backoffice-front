import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon, IconName } from '../ui/icon';

type Feature = Readonly<{ icon: IconName; title: string; text: string }>;

@Component({
  selector: 'lnd-features',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="funciones" class="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="features-title">
      <div class="mx-auto max-w-2xl text-center">
        <p class="text-primary text-sm font-semibold uppercase tracking-wider">Funciones</p>
        <h2 id="features-title" class="mt-2 text-3xl font-semibold sm:text-4xl">Todo lo que pasa en tu restaurante, conectado</h2>
        <p class="text-muted-foreground mt-4">Desde que el cliente se sienta hasta el cierre de caja: cada pedido llega a la cocina correcta y cada venta, gasto y movimiento de stock queda registrado.</p>
      </div>

      <ul class="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (feature of features; track feature.title) {
        <li class="lnd-card rounded-2xl p-6">
          <span class="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl p-2.5"><lnd-icon [name]="feature.icon" class="size-6" /></span>
          <h3 class="mt-4 text-lg font-semibold">{{ feature.title }}</h3>
          <p class="text-muted-foreground mt-2 text-sm leading-relaxed">{{ feature.text }}</p>
        </li>
        }
      </ul>
    </section>
  `,
})
export class Features {
  protected readonly features: Feature[] = [
    { icon: 'screen', title: 'POS y pedidos', text: 'Toma pedidos por mesa o para llevar, con opciones por producto ("extra queso", "sin palta"), cobra con varios medios de pago y divide la cuenta por productos.' },
    { icon: 'table', title: 'Mesas y sectores', text: 'Ve el estado de cada mesa en tiempo real, abre su cuenta con un toque y organiza el salón por sectores.' },
    { icon: 'chef', title: 'Cocina en pantalla', text: 'Cada estación (cocina, bar, parrilla) recibe solo lo suyo, con las notas del cliente, y marca lo que está listo.' },
    { icon: 'printer', title: 'Comandas impresas', text: 'Imprime las comandas en las impresoras de cada estación y prueba la conexión antes del servicio.' },
    { icon: 'calendar', title: 'Reservas', text: 'Agenda reservas por día o semana, asigna mesas según su capacidad y respeta tus horarios de atención.' },
    { icon: 'qr', title: 'Carta digital con QR', text: 'Cada mesa tiene su código QR para que tus clientes vean la carta con fotos y precios actualizados.' },
    { icon: 'wallet', title: 'Caja y turnos', text: 'Abre la caja con su fondo, registra retiros e ingresos y ciérrala con arqueo por billetes y monedas. El reporte Z muestra si faltó o sobró plata.' },
    { icon: 'receipt', title: 'Gastos y cuentas por pagar', text: 'Registra facturas con su IVA y el documento adjunto, controla vencimientos, paga en partes y automatiza gastos fijos como el arriendo.' },
    { icon: 'heart', title: 'Propinas y comisiones', text: 'Reparte y paga las propinas del equipo con comprobante, y ve cuánto te abonarán las tarjetas después de sus comisiones.' },
    { icon: 'box', title: 'Inventario y compras', text: 'Stock por local con kardex y alertas de mínimo, compras con IVA, conteos, mermas, transferencias entre locales y control de vencimientos.' },
    { icon: 'recipe', title: 'Recetas y food cost', text: 'Arma la receta de cada plato, descuenta el stock al vender y conoce cuánto te cuesta realmente cada uno.' },
    { icon: 'chart', title: 'Ventas y reportes', text: 'Revisa ventas por día, por categoría y por medio de pago, y compáralas con el período anterior.' },
    { icon: 'users', title: 'Tu equipo', text: 'Invita a meseros, cocina y caja con su propio rol, y deja que los meseros entren al POS con un PIN.' },
    { icon: 'sparkles', title: 'Asistente con IA', text: 'Pregúntale cómo hacer algo en Redom y te responde paso a paso desde cualquier pantalla, con las guías del centro de ayuda en que se basó.' },
    { icon: 'device', title: 'Sin instalar nada', text: 'Funciona en el navegador del computador, la tablet o el celular. Si tienes varias sucursales, las administras desde la misma cuenta.' },
  ];
}
