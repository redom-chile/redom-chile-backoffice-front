import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CartaI18n } from '../carta-i18n';
import { TableServiceStatus } from '../carta-table-service';
import { CartaIcon } from './carta-icon';

/**
 * Alternativa a la barra inferior (CARTA_BOTTOM_BAR = false): botones flotantes "Llamar al mesero" y "Pedir la cuenta"
 * a la derecha, sobre el botón del carrito cuando este se muestra.
 */
@Component({
  selector: 'app-carta-table-fabs',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="h-16" aria-hidden="true"></div>
    <div
      class="carta-embed-bottom pointer-events-none fixed inset-x-0 z-30"
      [style.bottom]="cartVisible() ? 'calc(env(safe-area-inset-bottom) + 5.5rem)' : 'calc(env(safe-area-inset-bottom) + 1rem)'"
    >
      <div class="mx-auto flex max-w-2xl flex-col items-end gap-2 px-4">
        <p class="sr-only" aria-live="polite">{{ status()?.text ?? '' }}</p>
        @if (status(); as s) {
          <p class="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-foreground py-1.5 pl-4 pr-1.5 text-sm font-medium text-background shadow-lg" aria-hidden="true">
            <span class="[overflow-wrap:anywhere]">{{ s.text }}</span>
            <button type="button" class="flex size-7 items-center justify-center rounded-full hover:bg-background/20" [attr.aria-label]="t('table.hideNotice')" (click)="dismissStatus.emit(s.id)">
              <app-carta-icon name="x" [size]="14" />
            </button>
          </p>
        }
        <div class="pointer-events-auto flex gap-2">
          <button
            type="button"
            class="relative flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold shadow-lg transition active:scale-95 motion-reduce:transition-none"
            (click)="waiter.emit()"
          >
            <app-carta-icon name="bell" [size]="18" class="text-primary" />
            {{ t('table.callWaiter') }}
            @if (callOpen()) {
              <span class="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-amber-500 ring-2 ring-background" aria-hidden="true"></span>
            }
          </button>
          <button
            type="button"
            class="flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold shadow-lg transition active:scale-95 motion-reduce:transition-none"
            (click)="bill.emit()"
          >
            <app-carta-icon name="wallet" [size]="18" class="text-primary" />
            {{ t('table.requestBill') }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CartaTableFabs {
  readonly cartVisible = input(false);
  readonly callOpen = input(false);
  readonly status = input<TableServiceStatus | null>(null);
  readonly waiter = output<void>();
  readonly bill = output<void>();
  readonly dismissStatus = output<number>();

  protected readonly t = inject(CartaI18n).t;
}
