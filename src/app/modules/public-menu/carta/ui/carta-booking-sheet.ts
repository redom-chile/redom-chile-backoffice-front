import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { PublicLocationMenuDto } from '../../data-access/dtos/public-menu.dto';
import { PublicBookingDto } from '../../data-access/dtos/table-service.dto';
import { PublicMenuApiService } from '../../data-access/public-menu-api.service';
import { BOOKING_LIMITS, bookingScheduleFit, dateInZone, formatBookingDate, weekdayOf, zonedToUtc } from '../carta-booking';
import { CartaI18n, cartaErrorMessage, cartaLanguage, ct } from '../carta-i18n';
import { buildWeekSchedule, todayIn } from '../carta-utils';
import { CartaIcon } from './carta-icon';
import { CartaLegal } from '../carta-legal';
import { CartaPrivacyNotice } from './carta-legal';

type Field = 'name' | 'phone' | 'date' | 'time';

const INPUT =
  'mt-1.5 w-full rounded-2xl border bg-card px-4 py-3 text-[0.9375rem] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 motion-reduce:transition-none';

/** Errores de POST /bookings (tabla de la etapa 4). */
function bookingErrorMessage(error: unknown): Readonly<{ message: string; disabled: boolean }> {
  const api = readApiError(error);
  switch (api.code) {
    case 'BOOKINGS_DISABLED':
      return { message: ct('booking.error.disabled'), disabled: true };
    case 'BOOKING_INVALID_DATES':
      return { message: ct('booking.error.range'), disabled: false };
    case 'BOOKING_OUTSIDE_HOURS':
      return { message: ct('booking.error.outside'), disabled: false };
    case 'BOOKING_CONTACT_OVERLAP':
      return { message: ct('booking.error.overlap'), disabled: false };
    case 'RATE_LIMITED':
      return { message: ct('booking.error.rateLimited'), disabled: false };
    case 'MENU_NOT_FOUND':
      return { message: ct('booking.error.notFound'), disabled: true };
    case 'LEGAL_VERSION_NOT_PUBLISHED':
      return { message: cartaErrorMessage(error), disabled: false };
  }
  if (api.status === 429) return { message: ct('booking.error.rateLimited'), disabled: false };
  if (api.status === 403) return { message: ct('booking.error.disabled'), disabled: true };
  if (api.status === 0) return { message: ct('booking.error.offline'), disabled: false };
  if (api.status === 400) return { message: ct('booking.error.invalid'), disabled: false };
  // El mensaje del backend viene en español
  const message = cartaLanguage() === 'es' && api.message ? api.message : ct('booking.error.send');
  return { message, disabled: false };
}

/**
 * "Reservar" (features.bookings, con o sin QR): nombre, teléfono, personas, fecha y hora en la zona del local y nota.
 * El horario del local guía la elección; la reserva queda esperando la confirmación del local.
 */
@Component({
  selector: 'app-carta-booking-sheet',
  imports: [CartaIcon, CartaPrivacyNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let m = menu();
    <div class="px-5 pb-6 pt-5">
      @if (result(); as r) {
        <div class="flex flex-col items-center py-6 text-center" role="status">
          <span class="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <app-carta-icon name="check" [size]="28" />
          </span>
          <h2 class="mt-4 text-xl font-bold tracking-tight">{{ t('booking.done') }}</h2>
          <dl class="mt-5 grid w-full gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('booking.location') }}</dt>
              <dd class="text-right font-semibold [overflow-wrap:anywhere]">{{ r.locationName }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('booking.date') }}</dt>
              <dd class="text-right font-semibold first-letter:uppercase">{{ resultDate().date }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('booking.time') }}</dt>
              <dd class="text-right font-semibold tabular-nums">{{ resultDate().time }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('booking.party') }}</dt>
              <dd class="text-right font-semibold tabular-nums">{{ r.partySize }}</dd>
            </div>
          </dl>
          <p class="mt-3 text-sm text-muted-foreground">{{ t('booking.contactNote') }}</p>
          <button
            type="button"
            class="mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] motion-reduce:transition-none"
            (click)="done.emit()"
          >
            {{ t('booking.back') }}
          </button>
        </div>
      } @else {
        <h2 class="flex items-center gap-2 pr-10 text-xl font-bold tracking-tight">
          <app-carta-icon name="calendar" [size]="22" class="text-primary" />
          {{ t('booking.title') }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{{ t('booking.intro', { location: m.location.name }) }}</p>

        <form class="mt-4 grid gap-4" novalidate (submit)="submit($event)">
          <div>
            <label for="carta-booking-name" class="block text-sm font-semibold">{{ t('booking.name') }}</label>
            <input
              id="carta-booking-name"
              type="text"
              autocomplete="name"
              [class]="inputClass('name')"
              [maxLength]="limits.name"
              [value]="name()"
              [attr.aria-invalid]="!!errors().name"
              [attr.aria-describedby]="errors().name ? 'carta-booking-name-error' : null"
              (input)="name.set($any($event.target).value)"
            />
            @if (errors().name; as e) {
              <p id="carta-booking-name-error" class="mt-1 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
            }
          </div>

          <div>
            <label for="carta-booking-phone" class="block text-sm font-semibold">{{ t('booking.phone') }}</label>
            <input
              id="carta-booking-phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="+56 9 1234 5678"
              [class]="inputClass('phone')"
              maxlength="24"
              [value]="phone()"
              [attr.aria-invalid]="!!errors().phone"
              [attr.aria-describedby]="errors().phone ? 'carta-booking-phone-error' : null"
              (input)="phone.set($any($event.target).value)"
            />
            @if (errors().phone; as e) {
              <p id="carta-booking-phone-error" class="mt-1 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
            }
          </div>

          <div>
            <span id="carta-booking-party-label" class="block text-sm font-semibold">{{ t('booking.party') }}</span>
            <div class="mt-1.5 flex items-center gap-3" role="group" aria-labelledby="carta-booking-party-label">
              <button
                type="button"
                class="flex size-11 items-center justify-center rounded-full border border-border transition hover:bg-muted disabled:opacity-40"
                [attr.aria-label]="t('booking.partyLess')"
                [disabled]="party() <= limits.minParty"
                (click)="party.set(party() - 1)"
              >
                <app-carta-icon name="minus" [size]="18" />
              </button>
              <output class="flex min-w-16 items-center justify-center gap-1.5 text-lg font-bold tabular-nums" aria-live="polite">
                <app-carta-icon name="users" [size]="18" class="text-muted-foreground" />
                {{ party() }}
              </output>
              <button
                type="button"
                class="flex size-11 items-center justify-center rounded-full border border-border transition hover:bg-muted disabled:opacity-40"
                [attr.aria-label]="t('booking.partyMore')"
                [disabled]="party() >= limits.maxParty"
                (click)="party.set(party() + 1)"
              >
                <app-carta-icon name="plus" [size]="18" />
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="carta-booking-date" class="block text-sm font-semibold">{{ t('booking.date') }}</label>
              <input
                id="carta-booking-date"
                type="date"
                [class]="inputClass('date')"
                [min]="minDate()"
                [max]="maxDate()"
                [value]="date()"
                [attr.aria-invalid]="!!errors().date"
                aria-describedby="carta-booking-day-hours"
                (input)="setWhen('date', $any($event.target).value)"
              />
            </div>
            <div>
              <label for="carta-booking-time" class="block text-sm font-semibold">{{ t('booking.time') }}</label>
              <input
                id="carta-booking-time"
                type="time"
                step="900"
                [class]="inputClass('time')"
                [value]="time()"
                [attr.aria-invalid]="!!errors().time"
                aria-describedby="carta-booking-day-hours"
                (input)="setWhen('time', $any($event.target).value)"
              />
            </div>
          </div>
          <div id="carta-booking-day-hours" class="-mt-2 grid gap-1 text-sm">
            @if (errors().date || errors().time; as e) {
              <p class="text-rose-600 dark:text-rose-400">{{ e }}</p>
            }
            @if (dayHours(); as h) {
              <p class="text-muted-foreground">{{ h }}</p>
            }
            @if (scheduleIssue(); as issue) {
              @if (issue !== errors().time) {
                <p class="flex items-start gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                  <app-carta-icon name="clock" [size]="14" class="mt-0.5" />
                  {{ issue }}
                </p>
              }
            }
            <p class="text-xs text-muted-foreground">{{ t('booking.timeHint', { location: m.location.name }) }}</p>
          </div>

          @if (week().length) {
            <details class="rounded-2xl border border-border bg-card text-sm">
              <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                <app-carta-icon name="clock" [size]="16" class="text-muted-foreground" />
                <span class="flex-1">{{ t('booking.schedule') }}</span>
                <app-carta-icon name="chevron-down" [size]="16" class="text-muted-foreground" />
              </summary>
              <ul class="border-t border-border px-4 py-2">
                @for (row of week(); track row.day) {
                  <li class="flex justify-between gap-4 py-1.5" [class.font-semibold]="row.day === selectedDay()">
                    <span>{{ row.name }}</span>
                    <span class="text-right" [class.text-muted-foreground]="row.closed">{{ row.hours }}</span>
                  </li>
                }
              </ul>
            </details>
          }

          <div>
            <label for="carta-booking-note" class="block text-sm font-semibold">{{ t('booking.note') }} <span class="font-normal text-muted-foreground">{{ t('booking.optional') }}</span></label>
            <textarea
              id="carta-booking-note"
              rows="2"
              class="{{ inputClass(null) }} resize-none"
              [placeholder]="t('booking.notePlaceholder')"
              [maxLength]="limits.note"
              [value]="note()"
              aria-describedby="carta-booking-note-count"
              (input)="note.set($any($event.target).value)"
            ></textarea>
            <p id="carta-booking-note-count" class="mt-1 text-right text-xs text-muted-foreground tabular-nums">{{ note().length }}/{{ limits.note }}</p>
          </div>

          <app-carta-privacy-notice />

          @if (error(); as e) {
            <p class="flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
              <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
              {{ e }}
            </p>
          }

          <button
            type="submit"
            class="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            [disabled]="sending() || disabled()"
          >
            <app-carta-icon name="calendar" [size]="18" />
            {{ sending() ? t('booking.sending') : t('booking.title') }}
          </button>
        </form>
      }
    </div>
  `,
})
export class CartaBookingSheet {
  readonly menu = input.required<PublicLocationMenuDto>();
  readonly done = output<void>();
  /** 403 BOOKINGS_DISABLED o 404: el padre oculta "Reservar". */
  readonly unavailable = output<void>();

  readonly #api = inject(PublicMenuApiService);
  readonly #legal = inject(CartaLegal);
  #sub: Subscription | null = null;
  protected readonly t = inject(CartaI18n).t;

  protected readonly limits = BOOKING_LIMITS;
  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly party = signal(2);
  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly note = signal('');
  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly disabled = signal(false);
  protected readonly result = signal<PublicBookingDto | null>(null);

  readonly #tz = computed(() => this.menu().location.timeZone);
  protected readonly minDate = computed(() => dateInZone(this.#tz()));
  protected readonly maxDate = computed(() => dateInZone(this.#tz(), BOOKING_LIMITS.maxAheadDays));
  protected readonly week = computed(() => buildWeekSchedule(this.menu().location.schedule));
  protected readonly selectedDay = computed(() => weekdayOf(this.date()) ?? todayIn(this.#tz()));
  protected readonly dayHours = computed(() => {
    const day = weekdayOf(this.date());
    if (day == null || !this.menu().location.schedule.length) return null;
    const row = this.week().find((r) => r.day === day);
    if (!row) return null;
    return row.closed ? ct('booking.dayClosed', { day: row.name.toLowerCase() }) : ct('booking.dayHours', { day: row.name, hours: row.hours });
  });
  /** La reserva completa (2 h) debe caber en un rango del horario; si no, el aviso y el envío bloqueado. */
  protected readonly scheduleIssue = computed(() => {
    const day = weekdayOf(this.date());
    if (day == null) return null;
    const fit = bookingScheduleFit(this.menu().location.schedule, day, this.time());
    if (!fit || fit.kind === 'ok') return null;
    if (fit.kind === 'closed') return ct('booking.outsideHours');
    const params = { hours: BOOKING_LIMITS.durationMinutes / 60, close: fit.closeTime };
    return fit.lastStart ? ct('booking.tooLate', { ...params, last: fit.lastStart }) : ct('booking.tooLateNoSlot', params);
  });
  protected readonly resultDate = computed(() => {
    const r = this.result();
    return r ? formatBookingDate(r.start, this.#tz()) : { date: '', time: '' };
  });

  protected readonly inputClass = (field: Field | null) =>
    `${INPUT} ${field && this.errors()[field] ? 'border-rose-500' : 'border-border'}`;

  /** Cambiar fecha u hora descarta los errores de ese bloque (el aviso de horario se recalcula solo). */
  protected setWhen(field: 'date' | 'time', value: string): void {
    this[field].set(value);
    if (this.errors().date || this.errors().time) this.errors.update(({ date: _d, time: _t, ...rest }) => rest);
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#sub?.unsubscribe());
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.sending() || this.disabled()) return;
    this.error.set(null);
    const errors: Partial<Record<Field, string>> = {};
    const name = this.name().trim();
    if (!name) errors.name = ct('booking.error.name');
    else if (name.length > BOOKING_LIMITS.name) errors.name = ct('booking.error.nameMax', { max: BOOKING_LIMITS.name });
    const digits = this.phone().replace(/\D/g, '');
    if (digits.length < BOOKING_LIMITS.minPhoneDigits || digits.length > BOOKING_LIMITS.maxPhoneDigits)
      errors.phone = ct('booking.error.phone');
    let start: number | null = null;
    if (!this.date()) errors.date = ct('booking.error.date');
    else if (!this.time()) errors.time = ct('booking.error.time');
    else {
      start = zonedToUtc(this.date(), this.time(), this.#tz());
      const now = Date.now();
      if (start == null) errors.time = ct('booking.error.dst');
      else if (start < now + BOOKING_LIMITS.minAheadMinutes * 60_000 || start > now + BOOKING_LIMITS.maxAheadDays * 86_400_000)
        errors.date = ct('booking.error.range');
      else {
        const issue = this.scheduleIssue();
        if (issue) errors.time = issue;
      }
    }
    this.errors.set(errors);
    if (Object.keys(errors).length || start == null) return;

    const note = this.note().trim().slice(0, BOOKING_LIMITS.note);
    const m = this.menu();
    this.sending.set(true);
    this.#sub?.unsubscribe();
    const startIso = new Date(start).toISOString();
    // Va la versión de privacyPolicy mostrada (si dejó de estar publicada, se recarga y se reintenta una vez)
    this.#sub = this.#legal
      .withPrivacy((privacy) =>
        this.#api.createBooking({
          businessSlug: m.business.slug,
          locationSlug: m.location.slug,
          name,
          phone: this.phone().trim(),
          partySize: this.party(),
          start: startIso,
          ...(note ? { note } : {}),
          ...privacy,
        }),
      )
      .subscribe({
        next: (booking) => {
          this.sending.set(false);
          this.result.set(booking);
        },
        error: (e) => {
          this.sending.set(false);
          const err = bookingErrorMessage(e);
          this.error.set(err.message);
          if (err.disabled) {
            this.disabled.set(true);
            this.unavailable.emit();
          }
        },
      });
  }
}
