import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PUBLIC_API_DOCS_URL } from 'src/app/modules/public-menu/data-access';
import { CodeBlockComponent } from 'src/app/modules/public-menu/features/public-api-shared';
import { IconComponent } from 'src/ui';
import { NODE_VERIFY_SNIPPET, PAYLOAD_EXAMPLE } from './webhook-format';

/** Ayuda para el desarrollador de la web del negocio: webhooks y la API con llave. Plegable. */
@Component({
  selector: 'app-public-api-developer-help',
  imports: [CodeBlockComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <details class="glass group rounded-[1rem]">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-semibold">
          <span class="inline-flex items-center gap-2"><app-icon class="h-5 w-5" aria-hidden="true">webhook</app-icon>Cómo recibir los webhooks</span>
          <app-icon class="text-muted-foreground h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true">expand_more</app-icon>
        </summary>
        <div class="text-foreground space-y-3 px-4 pb-4 text-sm">
          <p>
            Redom hace <code class="font-mono">POST</code> a tu URL con un JSON <code class="font-mono">{{ '{' }} id, event, createdAt, data {{ '}' }}</code>.
            <code class="font-mono">data</code> es el pedido, igual que <code class="font-mono">GET /public/v1/orders/{{ '{' }}id{{ '}' }}</code>.
          </p>
          <app-code-block label="Ejemplo de envío" [code]="payloadExample" />
          <ul class="list-disc space-y-1.5 pl-5">
            <li>
              Headers: <code class="font-mono">X-Redom-Event</code> (el evento), <code class="font-mono">X-Redom-Delivery</code> (el número del envío) y
              <code class="font-mono">X-Redom-Signature: t=&lt;unix&gt;,v1=&lt;firma&gt;</code>.
            </li>
            <li>
              Verifica la firma: <code class="font-mono">HMAC-SHA256(secreto, "&lt;t&gt;.&lt;cuerpo crudo&gt;")</code> en hexadecimal debe ser igual a
              <code class="font-mono">v1</code>. Rechaza los envíos con <code class="font-mono">t</code> de más de 5 minutos.
            </li>
            <li>Responde 2xx en menos de 5 segundos. Si no, Redom reintenta a los 1 min, 5 min, 30 min, 2 h, 6 h, 12 h y 24 h, y después lo marca fallido.</li>
            <li>Un mismo evento puede llegar más de una vez: usa el <code class="font-mono">id</code> para no procesarlo dos veces.</li>
          </ul>
          <app-code-block label="Node.js: verificar la firma" [code]="nodeSnippet" />
        </div>
      </details>

      <details class="glass group rounded-[1rem]">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-semibold">
          <span class="inline-flex items-center gap-2"><app-icon class="h-5 w-5" aria-hidden="true">code</app-icon>Para desarrolladores: la API con llave</span>
          <app-icon class="text-muted-foreground h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true">expand_more</app-icon>
        </summary>
        <div class="text-foreground space-y-2 px-4 pb-4 text-sm">
          <p>Todos los endpoints <code class="font-mono">/public/v1</code> aceptan el header opcional <code class="font-mono">X-Redom-Key</code>:</p>
          <ul class="list-disc space-y-1.5 pl-5">
            <li>
              <span class="font-mono">pk_live_</span> (publicable): solo desde sus orígenes permitidos (si no, 403
              <code class="font-mono">API_KEY_ORIGIN_NOT_ALLOWED</code>) y solo sobre tu negocio (403 <code class="font-mono">API_KEY_FORBIDDEN</code>).
            </li>
            <li>
              <span class="font-mono">sk_live_</span> (secreta): solo desde tu servidor. Permite leer los pedidos del negocio:
              <code class="font-mono">GET /public/v1/business/orders?status=&amp;locationId=&amp;limit=</code> y
              <code class="font-mono">GET /public/v1/business/orders/{{ '{' }}id{{ '}' }}</code>. Sin llave responde 401
              <code class="font-mono">SECRET_KEY_REQUIRED</code>; con una publicable, 403.
            </li>
            <li>Una llave inválida o revocada responde 401 <code class="font-mono">API_KEY_INVALID</code>.</li>
            <li>Límite: 600 llamadas por minuto por llave, además de los límites por IP.</li>
          </ul>
          <a [href]="docsUrl" target="_blank" rel="noopener" class="text-primary inline-flex items-center gap-1 font-medium hover:underline">
            Ver la documentación completa<app-icon class="h-4 w-4" aria-hidden="true">open_in_new</app-icon>
          </a>
        </div>
      </details>
    </div>
  `,
})
export class PublicApiDeveloperHelpComponent {
  readonly docsUrl = PUBLIC_API_DOCS_URL;
  readonly nodeSnippet = NODE_VERIFY_SNIPPET;
  readonly payloadExample = PAYLOAD_EXAMPLE;
}
