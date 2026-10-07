import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { ButtonComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { CashService, getCashErrorMessage } from '../../data-access';
import { CashZReportComponent } from '../../features/z-report';

/** Detalle de un turno de caja con su reporte Z. */
@Component({
  selector: 'app-cash-session-detail',
  imports: [RouterLink, ButtonComponent, IconComponent, SkeletonComponent, CashZReportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-detail.component.html',
})
export class CashSessionDetailComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #cash = inject(CashService);

  readonly $id = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('id')))), {
    initialValue: Number(this.#route.snapshot.paramMap.get('id')),
  });
  readonly $isValidId = computed(() => Number.isInteger(this.$id()) && this.$id() > 0);

  readonly session = rxResource({
    params: () => (this.$isValidId() ? this.$id() : undefined),
    stream: ({ params }) => this.#cash.getSession(params).pipe(toRemoteResult()),
  });

  readonly $session = computed(() => resultValue(this.session.value()));
  readonly $error = computed(() => resultError(this.session.value()));
  readonly $isNotFound = computed(() => !!this.$error() && readApiError(this.$error()).status === 404);
  readonly $errorMessage = computed(() => getCashErrorMessage(this.$error(), 'No se pudo cargar el turno.'));
}
