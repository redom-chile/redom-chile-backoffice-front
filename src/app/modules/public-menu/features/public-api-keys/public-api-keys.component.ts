import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, switchMap } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ApiKeyDto, PublicApiService } from 'src/app/modules/public-menu/data-access';
import {
  formatDateTime,
  formatRelative,
  KEY_KIND_LABELS,
  openSecretOnceModal,
  publicApiError,
} from 'src/app/modules/public-menu/features/public-api-shared';
import { isFeatureNotIncluded, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, EmptyStateComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { openApiKeyFormModal } from './api-key-form-modal.component';

/** Pestaña Llaves: llaves publicables (pk_live_) y secretas (sk_live_) de la API pública. */
@Component({
  selector: 'app-public-api-keys',
  imports: [MarketingUpsellCardComponent, ButtonComponent, IconComponent, SkeletonComponent, EmptyStateComponent, CheckPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-api-keys.component.html',
})
export class PublicApiKeysComponent {
  readonly #service = inject(PublicApiService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);

  readonly PERMISSIONS = PERMISSIONS;
  readonly kindLabels = KEY_KIND_LABELS;
  readonly formatRelative = formatRelative;
  readonly formatDateTime = formatDateTime;

  readonly keys = rxResource({ stream: () => this.#service.getKeys().pipe(toRemoteResult()) });
  readonly #list = linkedSignal(() => resultValue(this.keys.value()));
  /** Activas primero (el backend ya las ordena; se asegura al revocar en el lugar). */
  readonly $list = computed(() => {
    const list = this.#list();
    return list ? [...list].sort((a, b) => Number(!!a.revokedAt) - Number(!!b.revokedAt)) : null;
  });
  readonly $activeCount = computed(() => this.$list()?.filter((key) => !key.revokedAt).length ?? 0);
  readonly $error = computed(() => resultError(this.keys.value()));
  /** El plan cambió desde que se cargaron los entitlements. */
  readonly $blocked = computed(() => isFeatureNotIncluded(this.$error()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.$error()));
  readonly $errorMessage = computed(() => publicApiError(this.$error(), 'No se pudieron cargar las llaves.') ?? 'No se pudieron cargar las llaves.');
  readonly $busyId = signal<number | null>(null);

  create() {
    openApiKeyFormModal(this.#dialog)
      .pipe(filter((saved) => !!saved))
      .subscribe((saved) => {
        this.keys.reload();
        // La llave completa solo se pasa al modal: no queda en el estado de la página.
        if (saved && 'key' in saved) {
          openSecretOnceModal(this.#dialog, {
            title: `Llave "${saved.name}"`,
            secret: saved.key,
            description:
              saved.kind === 'secret'
                ? 'Esta es tu llave secreta. Ponla en el servidor de tu web (por ejemplo, en una variable de entorno).'
                : 'Esta es tu llave publicable. Úsala en el header X-Redom-Key desde los orígenes que indicaste.',
            warning: saved.kind === 'secret' ? 'Úsala solo en el servidor de tu web; nunca en la página.' : undefined,
          });
        }
      });
  }

  edit(apiKey: ApiKeyDto) {
    openApiKeyFormModal(this.#dialog, { apiKey })
      .pipe(filter((saved) => !!saved))
      .subscribe((saved) => this.#list.update((list) => list?.map((item) => (item.id === saved!.id ? { ...item, ...saved } : item)) ?? null));
  }

  revoke(apiKey: ApiKeyDto) {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Revocar llave',
          message: `¿Revocar "${apiKey.name}" (${apiKey.prefix}…)? Deja de funcionar al instante y no se puede deshacer.`,
          confirmText: 'Revocar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(apiKey.id);
          return this.#service.revokeKey(apiKey.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.#toast.show('Llave revocada', 'success');
          this.keys.reload();
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          const message = publicApiError(error, 'No se pudo revocar la llave.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }
}
