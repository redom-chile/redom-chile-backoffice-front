import { computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { getPublicMenuErrorMessage, MenuMarketingService } from 'src/app/modules/public-menu/data-access';
import { ToastService } from 'src/ui';
import { fromPackDto, PackEditorGroup, packSignature, toPackGroupInputs, validatePackGroups } from './pack-editor';

export type PackContentStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Contenido de un pack en el formulario del producto: va por PUT /products/:id/pack después de guardar el producto.
 * Requiere el plan menu_marketing; ver exige public-menu:see-module y editar public-menu:manage-marketing.
 */
export class PackContent {
  readonly #service = inject(MenuMarketingService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #access = inject(AccessService);

  readonly $hasPlan = computed(() => this.#entitlements.hasFeature('menu_marketing'));
  readonly canSee = this.#access.can([PERMISSIONS.PUBLIC_MENU.SEE_MODULE, PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING]);
  readonly canEdit = this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING);

  readonly $status = signal<PackContentStatus>('idle');
  readonly $groups = signal<readonly PackEditorGroup[]>([]);
  #initial = packSignature([]);

  /** Al editar un producto que ya es pack. Sin plan o sin permiso no se pide (evita el modal de plan). */
  async load(productId: number) {
    if (!this.$hasPlan() || !this.canSee) return;
    this.$status.set('loading');
    try {
      const pack = await firstValueFrom(this.#service.getPack(productId));
      const groups = fromPackDto(pack);
      this.$groups.set(groups);
      this.#initial = packSignature(groups);
      this.$status.set('ready');
    } catch {
      this.$status.set('error');
    }
  }

  /** Producto nuevo (o que recién pasa a ser pack): parte vacío. */
  startEmpty() {
    if (this.$status() === 'idle') this.$status.set('ready');
  }

  /** Hay algo que guardar: con plan y permiso, contenido cargado, cambios y al menos un grupo (o se vació uno que tenía). */
  #pending(isPack: boolean): boolean {
    if (!isPack || !this.$hasPlan() || !this.canEdit || this.$status() !== 'ready') return false;
    return packSignature(this.$groups()) !== this.#initial;
  }

  /** Antes de guardar el producto: así no queda guardado a medias. */
  validate(isPack: boolean): string | null {
    return this.#pending(isPack) ? validatePackGroups(this.$groups()) : null;
  }

  /** Después de guardar el producto. Si falla, el producto ya quedó guardado: se avisa y se sigue. */
  async saveIfChanged(productId: number | null, isPack: boolean, toast: ToastService): Promise<void> {
    if (!productId || !this.#pending(isPack)) return;
    try {
      await firstValueFrom(this.#service.setPack(productId, toPackGroupInputs(this.$groups())));
      this.#initial = packSignature(this.$groups());
    } catch (error) {
      const detail = getPublicMenuErrorMessage(error, '');
      toast.show(
        `El producto se guardó, pero no se pudo guardar el contenido del pack${detail ? `. ${detail}` : ''}`,
        'warning',
      );
    }
  }
}

/** Llamar en contexto de inyección. */
export function injectPackContent(): PackContent {
  return new PackContent();
}
