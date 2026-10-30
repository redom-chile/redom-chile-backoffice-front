import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Logotipo / isotipo de REDOM en SVG en línea (hereda el tema).
 * - Tamaño: por CSS con el `height` del host (el ancho sale del viewBox). Con `glass`, por `--redom-logo-size`.
 * - tone auto: color en claro y negativo en oscuro (clase `.dark` en <html>).
 * - La geometría es la de src/assets/brand/*.svg: no modificarla (el logotipo está dibujado, no es una fuente).
 * - animated (logotipo): cada cierto tiempo la "o" se vuelve a dibujar y el punto late, como la pantalla de carga.
 */
@Component({
  selector: 'app-redom-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-glass]': 'glass()',
    '[class.is-animated]': 'animated()',
    '[attr.role]': 'decorative() ? null : "img"',
    '[attr.aria-label]': 'decorative() ? null : "REDOM"',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
  },
  styleUrl: './redom-logo.component.css',
  template: `
    <div
      class="redom-logo-wrap"
      [class.tone-auto]="tone() === 'auto'"
      [class.tone-color]="tone() === 'color'"
      [class.tone-negativo]="tone() === 'negativo'"
      [class.tone-mono]="tone() === 'mono'">
      @if (glass()) {
        <div class="redom-glow" aria-hidden="true"></div>
      }
      <div [class.redom-glass]="glass()" class="redom-logo-panel">
        @if (variant() === 'logo') {
          <svg class="redom-logo-svg is-logo" xmlns="http://www.w3.org/2000/svg" viewBox="-24 -172 604.73 196" aria-hidden="true" focusable="false">
            <g fill="none" style="stroke: var(--redom-logo-ink)" stroke-width="18" stroke-linecap="butt">
              <path d="M9 0V-100" />
              <path d="M9 -50A41 41 0 0 1 71.73 -84.77" />
              <path d="M181.7 -51.43A41 41 0 1 0 173.04 -24.76" />
              <path d="M99.73 -50H181.73" />
              <path d="M293.73 -50A41 41 0 1 0 293.73 -49.93" />
              <path d="M293.73 0V-148" />
              <path class="redom-logo-o" d="M374.43 -90.6A41 41 0 1 0 406.74 -65.36" pathLength="100" />
              <path d="M439.73 0V-100" />
              <path d="M439.73 0V-64A27 27 0 0 1 493.73 -64V0" />
              <path d="M493.73 -64A27 27 0 0 1 547.73 -64V0" />
            </g>
            @if (glass()) {
              <circle class="redom-logo-halo" cx="393.97" cy="-82.31" r="16" fill="#E5532A" opacity=".35" />
            }
            <circle class="redom-logo-dot" cx="393.97" cy="-82.31" r="10" style="fill: var(--redom-logo-dot)" />
          </svg>
        } @else {
          <svg class="redom-logo-svg is-isotipo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <path d="M55.71 9.4A41 41 0 1 0 88.01 34.64" fill="none" style="stroke: var(--redom-logo-ink)" stroke-width="18" />
            @if (glass()) {
              <circle class="redom-logo-halo" cx="75.24" cy="17.69" r="16" fill="#E5532A" opacity=".35" />
            }
            <circle cx="75.24" cy="17.69" r="10" style="fill: var(--redom-logo-dot)" />
          </svg>
        }
        <ng-content />
      </div>
    </div>
  `,
})
export class RedomLogoComponent {
  readonly variant = input<'logo' | 'isotipo'>('logo');
  readonly tone = input<'color' | 'negativo' | 'mono' | 'auto'>('auto');
  readonly glass = input(false, { transform: booleanAttribute });
  /** Animación ocasional de la "o" (solo logotipo). Se desactiva con animated="false". */
  readonly animated = input(true, { transform: booleanAttribute });
  /** Junto a un texto que ya dice REDOM: se oculta a lectores de pantalla. */
  readonly decorative = input(false, { transform: booleanAttribute });
}
