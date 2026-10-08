import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ApiErrorCode, readApiError } from 'src/app/core/utils/api-error';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/cash/data-access';
import { CashRetryService } from 'src/app/modules/cash/features/cash-retry';
import { readDate, readId, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, IconComponent, ToastService } from 'src/ui';
import {
  CreateTipPayoutDto,
  getFinanceErrorMessage,
  PaymentMethod,
  TIP_MODE_HINTS,
  TIP_MODE_LABELS,
  TipDistributionDto,
  TipDistributionMode,
  TipDistributionRequestDto,
  TipsService,
} from '../../data-access';
import { localDate } from '../../features/payable-payments/payable-format';
import { parseTipPoints, TipParticipantRow, TipParticipantsComponent } from '../../features/tip-participants';
import { tipPeriodLabel } from '../../features/tip-receipt-print';

const MODES: readonly TipDistributionMode[] = ['individual', 'equal', 'points'];
const METHODS: readonly PaymentMethod[] = ['cash', 'transfer', 'debit', 'credit', 'other'];
const PREVIEW_DEBOUNCE_MS = 400;

type PreviewRequest = Readonly<{ key: string; dto: TipDistributionRequestDto | null; invalid: string | null }>;
type PreviewState = Readonly<{
  key: string;
  loading: boolean;
  value: TipDistributionDto | null;
  // Mensaje traducido (sin propinas, faltan participantes…): se muestra en la vista previa, no como toast.
  notice: string | null;
  noTips: boolean;
}>;

/** Estado de navegación hacia el detalle recién creado (ofrece imprimir). */
export type TipPayoutCreatedState = Readonly<{ tipPayoutCreated?: boolean }>;

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Nueva liquidación de propinas: período, modo, participantes con vista previa en vivo y pago. */
@Component({
  selector: 'app-tip-payout-new',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, IconComponent, TipParticipantsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tip-payout-new.component.html',
})
export class TipPayoutNewComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #tips = inject(TipsService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #locations = inject(GetAllBusinessLocationsService);
  readonly #cashRetry = inject(CashRetryService);
  readonly #toast = inject(ToastService);

  readonly modes = MODES;
  readonly modeLabels = TIP_MODE_LABELS;
  readonly modeHints = TIP_MODE_HINTS;
  readonly methods = METHODS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly formatCurrency = formatCurrency;
  readonly periodLabel = tipPeriodLabel;
  readonly today = localDate();

  // ---------- Paso 1: período, local, modo y participantes ----------
  readonly #params = this.#route.snapshot.queryParamMap;
  // Sin "desde": todas las pendientes hasta "hasta".
  readonly $dateFrom = signal(readDate(this.#params, 'from') ?? '');
  readonly $dateTo = signal(readDate(this.#params, 'to') ?? this.today);
  readonly $locationId = signal<number | null>(readId(this.#params, 'locationId'));
  readonly $mode = linkedSignal<TipDistributionMode>(() => this.#settings.$settings()?.tipDistributionMode ?? 'individual');
  readonly $participants = signal<TipParticipantRow[]>([]);

  readonly $locationOptions = computed(() => (this.#locations.$locations() ?? []).map((location) => ({ id: location.id, name: location.name })));
  readonly $showLocations = computed(() => this.$locationOptions().length > 1 || this.$locationId() !== null);

  readonly #period = computed(() => ({
    dateFrom: this.$dateFrom() || undefined,
    dateTo: this.$dateTo() || undefined,
    locationId: this.$locationId() ?? undefined,
  }));

  // Pendientes del período: sugerencias de participantes (meseros con propinas).
  readonly pending = rxResource({
    params: () => (this.#periodError() ? undefined : this.#period()),
    stream: ({ params }) => this.#tips.pending(params).pipe(toRemoteResult()),
  });
  readonly $pending = computed(() => resultValue(this.pending.value()));
  readonly $suggestions = computed(() => this.$pending()?.byWaiter ?? []);

  readonly #periodError = computed(() => {
    const from = this.$dateFrom();
    const to = this.$dateTo();
    if (from && to && from > to) return 'La fecha "desde" no puede ser posterior a "hasta".';
    if (to && to > this.today) return 'La fecha "hasta" no puede ser futura.';
    return null;
  });

  readonly #request = computed<PreviewRequest>(() => {
    const period = this.#period();
    const mode = this.$mode();
    const rows = this.$participants();
    const invalid = this.#periodError() ?? (mode === 'points' && rows.some((row) => parseTipPoints(row.points) === null) ? 'Revisa los puntos: números ≥ 0 con hasta 2 decimales.' : null);
    const participants = rows.map((row) => (mode === 'points' ? { userCode: row.userCode, points: parseTipPoints(row.points) ?? 0 } : { userCode: row.userCode }));
    const dto: TipDistributionRequestDto = { ...period, mode, ...(participants.length ? { participants } : {}) };
    return { key: JSON.stringify(dto), dto: invalid ? null : dto, invalid };
  });
  readonly #reloadPreview = signal(0);

  readonly $preview = toSignal(
    toObservable(computed(() => ({ request: this.#request(), reload: this.#reloadPreview() }))).pipe(
      debounceTime(PREVIEW_DEBOUNCE_MS),
      switchMap(({ request }) => {
        const { key, dto, invalid } = request;
        if (!dto) return of<PreviewState>({ key, loading: false, value: null, notice: invalid, noTips: false });
        return this.#tips.preview(dto).pipe(
          map((value): PreviewState => ({ key, loading: false, value, notice: null, noTips: false })),
          catchError((error: unknown) => {
            const api = readApiError(error);
            const noTips = api.code === ApiErrorCode.NO_TIPS_TO_PAY;
            return of<PreviewState>({ key, loading: false, value: null, notice: getFinanceErrorMessage(error, 'No se pudo calcular el reparto.'), noTips });
          }),
          startWith<PreviewState>({ key, loading: true, value: null, notice: null, noTips: false }),
        );
      }),
    ),
    { initialValue: null },
  );
  // La vista previa no corresponde a lo que hay en pantalla (cambió y aún no se recalcula).
  readonly $isPreviewStale = computed(() => {
    const preview = this.$preview();
    return !preview || preview.loading || preview.key !== this.#request().key;
  });
  // Último resultado bueno para no parpadear mientras se recalcula.
  readonly $lastPreview = linkedSignal<PreviewState | null, TipDistributionDto | null>({
    source: this.$preview,
    computation: (state, previous) => (state?.loading ? (previous?.value ?? null) : (state?.value ?? null)),
  });

  // ---------- Paso 2: pago ----------
  readonly $method = signal<PaymentMethod>('cash');
  readonly #initialPaidAt = toLocalInput(new Date());
  readonly maxPaidAt = toLocalInput(new Date(Date.now() + 60_000));
  readonly paidAt = new FormControl(this.#initialPaidAt, { nonNullable: true, validators: [Validators.required] });
  readonly reference = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] });
  readonly note = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] });
  readonly $isSaving = signal(false);

  readonly $cashEnabled = this.#settings.$cashManagementEnabled;
  // Con caja activa y varios locales, el efectivo necesita saber de qué local (y caja) sale.
  readonly $cashNeedsLocation = computed(
    () => this.$method() === 'cash' && this.$cashEnabled() && this.$locationId() === null && this.$locationOptions().length !== 1,
  );
  readonly $canSubmit = computed(() => {
    const preview = this.$preview();
    return !this.$isSaving() && !this.$isPreviewStale() && !!preview?.value && preview.value.total > 0 && preview.value.lines.length > 0 && !this.$cashNeedsLocation();
  });

  constructor() {
    // En modo puntos se precargan los meseros con propinas (con 1 punto) si aún no hay nadie.
    effect(() => {
      if (this.$mode() !== 'points') return;
      const suggestions = this.$suggestions();
      if (!suggestions.length) return;
      untracked(() => {
        if (this.$participants().length) return;
        this.$participants.set(suggestions.map((s) => ({ userCode: s.userCode, name: s.name ?? 'Sin nombre', points: '1' })));
      });
    });
  }

  onDate(key: 'from' | 'to', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (key === 'from') this.$dateFrom.set(value);
    else this.$dateTo.set(value || this.today);
  }

  onLocation(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.$locationId.set(value > 0 ? value : null);
  }

  setMode(mode: TipDistributionMode) {
    this.$mode.set(mode);
  }

  submit() {
    const preview = this.$preview()?.value;
    if (!this.$canSubmit() || !preview) return;
    const paidAt = this.paidAt.value;
    const paidDate = new Date(paidAt);
    if (!paidAt || Number.isNaN(paidDate.getTime())) {
      this.#toast.show('Indica la fecha del pago', 'warning');
      return;
    }
    if (paidDate.getTime() > Date.now() + 5 * 60_000) {
      this.#toast.show('La fecha del pago no puede ser futura', 'warning');
      return;
    }
    const method = this.$method();
    const request = this.#request().dto;
    if (!request) return;
    // Con un solo local, el efectivo sale de ese local.
    const locationId = request.locationId ?? (method === 'cash' && this.$cashEnabled() && this.$locationOptions().length === 1 ? this.$locationOptions()[0].id : undefined);
    const reference = this.reference.value.trim();
    const note = this.note.value.trim();
    const dto: CreateTipPayoutDto = {
      ...request,
      ...(locationId ? { locationId } : {}),
      method,
      ...(paidAt !== this.#initialPaidAt ? { paidAt: paidDate.toISOString() } : {}),
      ...(reference ? { reference } : {}),
      ...(note ? { note } : {}),
    };
    const people = preview.lines.length;
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Liquidar propinas',
          message:
            `Se pagarán ${formatCurrency(preview.total)} a ${people} ${people === 1 ? 'persona' : 'personas'} en ${(PAYMENT_METHOD_LABELS[method] ?? method).toLowerCase()}. ` +
            `Las propinas del período quedarán pagadas.${method === 'cash' && this.$cashEnabled() ? ' El efectivo sale de la caja abierta.' : ''}`,
          confirmText: 'Liquidar',
          cancelText: 'Volver',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const cashRegisterId = method === 'cash' ? this.#cashRetry.deviceRegister(locationId ?? null) : undefined;
        this.$isSaving.set(true);
        this.#send(dto, cashRegisterId, true);
      });
  }

  #send(base: CreateTipPayoutDto, cashRegisterId: number | undefined, canRetryWithoutRegister: boolean) {
    const dto: CreateTipPayoutDto = cashRegisterId ? { ...base, cashRegisterId } : base;
    this.#tips
      .createPayout(dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (payout) => {
          this.$isSaving.set(false);
          this.#toast.show(`Propinas liquidadas · ${formatCurrency(payout.total)}`, 'success');
          const state: TipPayoutCreatedState = { tipPayoutCreated: true };
          this.#router.navigate(['/finance/tips/payouts', payout.id], { state, replaceUrl: true });
        },
        error: (error: unknown) => this.#handleError(error, base, cashRegisterId, canRetryWithoutRegister),
      });
  }

  #handleError(error: unknown, dto: CreateTipPayoutDto, cashRegisterId: number | undefined, canRetryWithoutRegister: boolean) {
    const api = readApiError(error);
    const isCashError = api.code?.startsWith('CASH_') || /cash register/i.test(api.message);

    if (dto.method !== 'cash' || !isCashError) {
      this.$isSaving.set(false);
      // Otro pagó entretanto o cambió el período: se recalcula la vista previa.
      if (api.code === ApiErrorCode.NO_TIPS_TO_PAY || api.status === 404) {
        this.#toast.show(getFinanceErrorMessage(error), 'warning');
        this.pending.reload();
        this.#reloadPreview.update((n) => n + 1);
        return;
      }
      this.#toast.show(getFinanceErrorMessage(error, 'No se pudo liquidar las propinas'), 'error');
      return;
    }

    this.#cashRetry
      .resolve(api, {
        locationId: dto.locationId ?? null,
        cashRegisterId: cashRegisterId ?? null,
        purpose: 'Para pagar las propinas en efectivo la caja debe estar abierta: el dinero sale de ella.',
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((registerId) => {
        if (registerId) return this.#send(dto, registerId, false);
        // La caja recordada ya no sirve (se olvidó): se reintenta una vez sin ella.
        if (registerId === undefined && cashRegisterId && canRetryWithoutRegister && /cash register (not found|is inactive)|belongs to another location/i.test(api.message)) {
          return this.#send(dto, undefined, false);
        }
        this.$isSaving.set(false);
        if (registerId === undefined) this.#toast.show(getFinanceErrorMessage(error, 'No se pudo liquidar las propinas'), 'error');
      });
  }
}
