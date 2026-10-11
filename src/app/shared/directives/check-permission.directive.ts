import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AccessService, PermissionCode } from 'src/app/core/permissions';

/**
 * Muestra el elemento solo si el usuario tiene el permiso (SUPERADMIN, todos). Con una lista basta uno;
 * con `all`, todos. `else` muestra otra plantilla en su lugar.
 * Uso: `*appCheckPermission="PERMISSIONS.ORDERS.CANCEL_ORDER; else: sinPermiso"`.
 * Se vuelve a evaluar al cambiar los permisos (whoami se refresca cada minuto).
 */
@Directive({
  selector: '[appCheckPermission]',
})
export class CheckPermissionDirective {
  readonly #templateRef = inject(TemplateRef);
  readonly #viewContainer = inject(ViewContainerRef);
  readonly #access = inject(AccessService);

  /** Sin permiso (undefined o lista vacía) se muestra siempre. */
  readonly permission = input<PermissionCode | readonly PermissionCode[] | null | undefined>(undefined, {
    alias: 'appCheckPermission',
  });
  readonly all = input(false, { alias: 'appCheckPermissionAll' });
  readonly elseTemplate = input<TemplateRef<unknown> | null>(null, { alias: 'appCheckPermissionElse' });

  #shown: TemplateRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const permission = this.permission();
      const allowed = !permission || this.#access.can(permission, this.all() ? 'all' : 'any');
      const template = allowed ? this.#templateRef : this.elseTemplate();
      if (template === this.#shown) return;
      this.#viewContainer.clear();
      if (template) this.#viewContainer.createEmbeddedView(template);
      this.#shown = template;
    });
  }
}
