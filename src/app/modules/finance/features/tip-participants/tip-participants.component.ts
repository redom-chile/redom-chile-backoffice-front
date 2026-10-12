import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { UserDto } from 'src/app/modules/roles-and-permissions/pages/users/data-access';
import { ApiPathEnum } from 'src/environments';
import { IconComponent } from 'src/ui';
import { TipDistributionMode } from '../../data-access';

export type TipParticipantRow = Readonly<{
  userCode: string;
  name: string;
  // Texto del input de puntos (solo en modo points).
  points: string;
}>;

export type TipParticipantSuggestion = Readonly<{ userCode: string; name: string | null; tips: number }>;

type SearchState = Readonly<{ loading: boolean; error: boolean; users: ReadonlyArray<{ code: string; name: string }> }>;

// El backend admite hasta 100 participantes.
export const MAX_TIP_PARTICIPANTS = 100;

const POINTS_PATTERN = /^\d+([.,]\d{1,2})?$/;

/** Puntos válidos (≥ 0, hasta 2 decimales) o null. */
export function parseTipPoints(value: string): number | null {
  const raw = value.trim();
  if (!POINTS_PATTERN.test(raw)) return null;
  return Number(raw.replace(',', '.'));
}

function userName(user: UserDto): string {
  return [user.name, user.fatherLastName].filter(Boolean).join(' ').trim() || user.email || user.code;
}

/** Participantes de un reparto de propinas: buscador de usuarios del negocio, sugerencias (meseros con propinas) y puntos. */
@Component({
  selector: 'app-tip-participants',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tip-participants.component.html',
})
export class TipParticipantsComponent {
  readonly #http = inject(HttpClient);

  readonly $mode = input.required<TipDistributionMode>({ alias: 'mode' });
  readonly $suggestions = input<ReadonlyArray<TipParticipantSuggestion>>([], { alias: 'suggestions' });
  readonly $disabled = input(false, { alias: 'disabled' });
  readonly participants = model<TipParticipantRow[]>([]);

  readonly formatCurrency = formatCurrency;
  readonly parsePoints = parseTipPoints;
  readonly max = MAX_TIP_PARTICIPANTS;

  readonly $search = signal('');

  readonly #added = computed(() => new Set(this.participants().map((row) => row.userCode)));
  readonly $pendingSuggestions = computed(() => this.$suggestions().filter((s) => !this.#added().has(s.userCode)));
  readonly $isFull = computed(() => this.participants().length >= MAX_TIP_PARTICIPANTS);

  readonly #searchState = toSignal(
    toObservable(this.$search).pipe(
      map((term) => term.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term) => {
        if (!term) return of<SearchState>({ loading: false, error: false, users: [] });
        // activated=true: los usuarios eliminados o inactivos darían 404 al liquidar.
        const params = new HttpParams().set('page', '1').set('perPage', '20').set('name', term).set('activated', 'true');
        return this.#http.get<StandardizedPagination<UserDto>>(`${ApiPathEnum.AUTH}/users`, { params }).pipe(
          map((page): SearchState => ({ loading: false, error: false, users: page.data.map((user) => ({ code: user.code, name: userName(user) })) })),
          catchError(() => of<SearchState>({ loading: false, error: true, users: [] })),
          startWith<SearchState>({ loading: true, error: false, users: [] }),
        );
      }),
    ),
    { initialValue: { loading: false, error: false, users: [] } as SearchState },
  );
  readonly $searchState = this.#searchState;
  readonly $results = computed(() => this.#searchState().users.filter((user) => !this.#added().has(user.code)));

  readonly $title = computed(() => {
    switch (this.$mode()) {
      case 'individual':
        return 'Comparten las propinas sin mesero';
      case 'points':
        return 'Participantes y puntos';
      default:
        return 'Participantes';
    }
  });
  readonly $hint = computed(() => {
    switch (this.$mode()) {
      case 'individual':
        return 'Los meseros con propinas se incluyen solos. Agrega aquí a quienes también comparten las propinas de pedidos sin mesero (opcional).';
      case 'points':
        return 'Obligatorio. Cada uno recibe en proporción a sus puntos (ej. mesero 2, ayudante 1).';
      default:
        return 'Si no agregas a nadie, se reparte entre los meseros con propinas.';
    }
  });

  onSearch(event: Event) {
    this.$search.set((event.target as HTMLInputElement).value);
  }

  add(userCode: string, name: string | null) {
    if (this.#added().has(userCode) || this.$isFull()) return;
    this.participants.update((rows) => [...rows, { userCode, name: name ?? 'Sin nombre', points: '1' }]);
  }

  addFromSearch(user: { code: string; name: string }) {
    this.add(user.code, user.name);
    this.$search.set('');
  }

  addAllSuggestions() {
    const room = MAX_TIP_PARTICIPANTS - this.participants().length;
    const rows = this.$pendingSuggestions()
      .slice(0, Math.max(room, 0))
      .map((s): TipParticipantRow => ({ userCode: s.userCode, name: s.name ?? 'Sin nombre', points: '1' }));
    if (rows.length) this.participants.update((current) => [...current, ...rows]);
  }

  remove(userCode: string) {
    this.participants.update((rows) => rows.filter((row) => row.userCode !== userCode));
  }

  setPoints(userCode: string, event: Event) {
    const points = (event.target as HTMLInputElement).value;
    this.participants.update((rows) => rows.map((row) => (row.userCode === userCode ? { ...row, points } : row)));
  }

  clear() {
    this.participants.set([]);
  }
}
