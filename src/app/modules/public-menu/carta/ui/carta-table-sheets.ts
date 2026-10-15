import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { TableBillDto } from '../../data-access/dtos/table-service.dto';
import { PublicMenuApiService } from '../../data-access/public-menu-api.service';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartaTableService, formatClock, MAX_TABLE_REQUEST_NOTE, readTableServiceError } from '../carta-table-service';
import { CartaI18n } from '../carta-i18n';
import { CartaIcon } from './carta-icon';

const PRIMARY_BUTTON =
  'flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const SECONDARY_BUTTON =
  'w-full rounded-full border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary';

/** "Llamar al mesero": nota opcional (≤ 200) y POST type call_waiter. */
@Component({
  selector: 'app-carta-waiter-sheet',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="px-5 pb-6 pt-5">
      <h2 class="flex items-center gap-2 pr-10 text-xl font-bold tracking-tight">
        <app-carta-icon name="bell" [size]="22" class="text-primary" />
        {{ t('table.callWaiter') }}
      </h2>
      <div aria-live="polite">
        @if (open(); as r) {
          <p class="mt-4 flex items-start gap-3 rounded-2xl bg-amber-500/15 px-4 py-3 text-[0.9375rem] font-semibold text-amber-800 dark:text-amber-300">
            <app-carta-icon name="check" [size]="18" class="mt-px" />
            <span>{{ t('table.status.call', { time: time(r.createdAt) }) }}</span>
          </p>
          @if (r.note) {
            <p class="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]"><span class="font-semibold text-foreground">{{ t('table.noteLabel') }}</span> {{ r.note }}</p>
          }
        } @else if (service.status()?.tone === 'attended') {
          <p class="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-500/15 px-4 py-3 text-[0.9375rem] font-semibold text-emerald-800 dark:text-emerald-300">
            <app-carta-icon name="check" [size]="18" class="mt-px" />
            {{ t('table.status.attended') }}
          </p>
        }
      </div>

      @if (open()) {
        <button type="button" class="mt-5 {{ secondary }}" (click)="done.emit()">{{ t('table.gotIt') }}</button>
      } @else {
        <p class="mt-2 text-sm text-muted-foreground">{{ t('table.waiterIntro') }}</p>
        <label for="carta-waiter-note" class="mt-4 block text-sm font-semibold">{{ t('table.note') }} <span class="font-normal text-muted-foreground">{{ t('table.optional') }}</span></label>
        <textarea
          id="carta-waiter-note"
          rows="2"
          class="mt-1.5 w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[0.9375rem] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          [placeholder]="t('table.waiterPlaceholder')"
          [maxLength]="maxNote"
          [value]="note()"
          aria-describedby="carta-waiter-note-count"
          (input)="note.set($any($event.target).value)"
        ></textarea>
        <p id="carta-waiter-note-count" class="mt-1 text-right text-xs text-muted-foreground tabular-nums">{{ note().length }}/{{ maxNote }}</p>
        @if (error(); as e) {
          <p class="mt-2 flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
            <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
            {{ e }}
          </p>
        }
        <button type="button" class="mt-4 {{ primary }}" [disabled]="sending()" (click)="send()">
          <app-carta-icon name="bell" [size]="18" />
          {{ sending() ? t('table.sending') : t('table.callWaiter') }}
        </button>
      }
    </div>
  `,
})
export class CartaWaiterSheet {
  readonly timeZone = input('America/Santiago');
  readonly done = output<void>();

  protected readonly service = inject(CartaTableService);
  protected readonly open = this.service.openCall;
  protected readonly note = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly maxNote = MAX_TABLE_REQUEST_NOTE;
  protected readonly primary = PRIMARY_BUTTON;
  protected readonly secondary = SECONDARY_BUTTON;
  protected readonly time = (iso: string) => formatClock(iso, this.timeZone());
  protected readonly t = inject(CartaI18n).t;

  #sub: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#sub?.unsubscribe());
  }

  protected send(): void {
    if (this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    this.#sub = this.service.send('call_waiter', this.note().slice(0, MAX_TABLE_REQUEST_NOTE)).subscribe({
      next: () => this.sending.set(false),
      error: (e) => {
        this.sending.set(false);
        const err = readTableServiceError(e);
        if (err.disabled) this.done.emit();
        else this.error.set(err.message);
      },
    });
  }
}

/** "Pedir la cuenta": primero GET /bill (consumo, propina sugerida) y luego POST type request_bill. */
@Component({
  selector: 'app-carta-bill-sheet',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="px-5 pb-6 pt-5">
      <h2 class="flex items-center gap-2 pr-10 text-xl font-bold tracking-tight">
        <app-carta-icon name="wallet" [size]="22" class="text-primary" />
        {{ t('table.yourBill') }}
      </h2>

      @if (loading()) {
        <div class="mt-4 grid gap-2" aria-busy="true" [attr.aria-label]="t('table.loadingBill')">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-10 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"></div>
          }
        </div>
      } @else if (loadError(); as e) {
        <p class="mt-4 flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
          {{ e }}
        </p>
        <button type="button" class="mt-4 {{ secondary }}" (click)="load()">{{ t('table.retry') }}</button>
      } @else if (bill(); as b) {
        @if (b.open) {
          <p class="mt-1 text-sm text-muted-foreground">
            {{ b.table.name }}
            @if (b.invoiceNo) {
              · {{ t('table.invoiceNo', { n: b.invoiceNo }) }}
            }
          </p>
          <ul class="mt-4 divide-y divide-border rounded-2xl border border-border" [attr.aria-label]="t('table.consumption')">
            @for (line of b.lines; track $index) {
              <li class="flex items-start gap-3 px-4 py-3 text-sm">
                <span class="shrink-0 font-semibold tabular-nums">{{ line.quantity }} ×</span>
                <span class="min-w-0 flex-1">
                  <span class="block font-medium [overflow-wrap:anywhere]">{{ line.name }}</span>
                  @for (p of line.packItems; track $index) {
                    <span class="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{{ p }}</span>
                  }
                  @for (mod of line.modifiers; track $index) {
                    <span class="block text-xs text-muted-foreground [overflow-wrap:anywhere]">+ {{ mod }}</span>
                  }
                </span>
                <span class="shrink-0 font-semibold tabular-nums">{{ format(line.total) }}</span>
              </li>
            }
          </ul>

          <dl class="mt-4 grid gap-1.5 text-sm">
            @if (b.discount) {
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">{{ t('table.subtotal') }}</dt>
                <dd class="tabular-nums">{{ format(b.subtotal) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">{{ t('table.discount') }}</dt>
                <dd class="tabular-nums">−{{ format(b.discount) }}</dd>
              </div>
            }
            <div class="flex items-baseline justify-between gap-3">
              <dt class="font-semibold">{{ t('table.total') }}</dt>
              <dd class="text-base font-bold tabular-nums">{{ format(b.total) }}</dd>
            </div>
            @if (b.paid) {
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">{{ t('table.paid') }}</dt>
                <dd class="tabular-nums">{{ format(b.paid) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="font-semibold">{{ t('table.remaining') }}</dt>
                <dd class="font-semibold tabular-nums">{{ format(b.remaining) }}</dd>
              </div>
            }
          </dl>

          @if (b.suggestedTip != null && b.suggestedTip > 0) {
            <dl class="mt-4 grid gap-1.5 rounded-2xl bg-muted px-4 py-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">{{ t('table.suggestedTip', { percent: b.suggestedTipPercent ?? '' }) }}</dt>
                <dd class="tabular-nums">{{ format(b.suggestedTip) }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="font-semibold">{{ t('table.totalWithTip') }}</dt>
                <dd class="text-base font-bold tabular-nums">{{ format(b.total + b.suggestedTip) }}</dd>
              </div>
            </dl>
          }

          <div class="mt-5" aria-live="polite">
            @if (requested(); as r) {
              <p class="flex items-start gap-3 rounded-2xl bg-amber-500/15 px-4 py-3 text-[0.9375rem] font-semibold text-amber-800 dark:text-amber-300">
                <app-carta-icon name="check" [size]="18" class="mt-px" />
                <span>{{ t('table.billRequested', { time: time(r.createdAt) }) }}</span>
              </p>
              <button type="button" class="mt-4 {{ secondary }}" (click)="done.emit()">{{ t('table.gotIt') }}</button>
            } @else {
              @if (sendError(); as e) {
                <p class="mb-3 flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
                  <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
                  {{ e }}
                </p>
              }
              <button type="button" [class]="primary" [disabled]="sending()" (click)="request()">
                <app-carta-icon name="wallet" [size]="18" />
                {{ sending() ? t('table.sending') : t('table.requestBill') }}
              </button>
            }
          </div>
        } @else {
          <div class="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
            <app-carta-icon name="receipt" [size]="28" />
            <p class="text-[0.9375rem] font-medium text-foreground">{{ t('table.noConsumption') }}</p>
          </div>
          <button type="button" [class]="secondary" (click)="done.emit()">{{ t('table.keepBrowsing') }}</button>
        }
      }
    </div>
  `,
})
export class CartaBillSheet implements OnInit {
  readonly qr = input.required<string>();
  readonly timeZone = input('America/Santiago');
  readonly done = output<void>();

  readonly #api = inject(PublicMenuApiService);
  protected readonly service = inject(CartaTableService);

  protected readonly bill = signal<TableBillDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly sendError = signal<string | null>(null);
  protected readonly requested = computed(() => this.service.openBill());

  protected readonly format = formatMenuPrice;
  protected readonly primary = PRIMARY_BUTTON;
  protected readonly secondary = SECONDARY_BUTTON;
  protected readonly time = (iso: string) => formatClock(iso, this.timeZone());
  protected readonly t = inject(CartaI18n).t;

  #subs = new Subscription();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#subs.unsubscribe());
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.#subs.add(
      this.#api.getTableBill(this.qr()).subscribe({
        next: (bill) => {
          this.bill.set(bill);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          const err = readTableServiceError(e, this.t('table.error.bill'));
          if (err.disabled) {
            this.service.unavailable.set(true);
            this.done.emit();
          } else this.loadError.set(err.message);
        },
      }),
    );
  }

  protected request(): void {
    if (this.sending()) return;
    this.sending.set(true);
    this.sendError.set(null);
    this.#subs.add(
      this.service.send('request_bill').subscribe({
        next: () => this.sending.set(false),
        error: (e) => {
          this.sending.set(false);
          const err = readTableServiceError(e);
          if (err.disabled) this.done.emit();
          else this.sendError.set(err.message);
        },
      }),
    );
  }
}
