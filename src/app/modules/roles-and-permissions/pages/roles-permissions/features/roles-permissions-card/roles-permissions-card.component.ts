import { animate, style, transition, trigger } from '@angular/animations';
import { Component, computed, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { ModulePermissionsDto } from '../../../permissions/data-access';
import { CardComponent } from 'src/ui/templates/single-card';
import { SlotDirective, IconComponent, ToggleComponent } from 'src/ui';
import { PermissionsListSkeletonComponent } from '../../ui';
import { AccessService } from 'src/app/core/permissions';

/** Por qué no se puede cambiar un permiso (null = se puede). */
type LockReason = 'plan' | 'not_owned' | 'read_only' | null;

const LOCK_HINTS: Record<Exclude<LockReason, null>, string> = {
  plan: 'Tu plan no incluye este módulo',
  not_owned: 'No puedes dar permisos que no tienes',
  read_only: 'No tienes permiso para cambiar los permisos de un rol',
};

@Component({
  selector: 'app-roles-permissions-card',
  imports: [
    CardComponent,
    SlotDirective,
    IconComponent,
    ToggleComponent,
    PermissionsListSkeletonComponent,
  ],
  templateUrl: './roles-permissions-card.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ opacity: 0, height: '0px', overflow: 'hidden' }),
        animate('200ms ease-out', style({ opacity: 1, height: '*' })),
      ]),
      transition(':leave', [
        style({ opacity: 1, height: '*', overflow: 'hidden' }),
        animate('200ms ease-in', style({ opacity: 0, height: '0px' })),
      ]),
    ]),
  ],
})
export class RolesPermissionsCardComponent {
  readonly #access = inject(AccessService);

  readonly $modules = input.required<ModulePermissionsDto[]>({ alias: 'modules' });
  readonly rolePermissionIds = input.required<Set<number>>({ alias: 'rolePermissionIds' });
  readonly isLoading = input<boolean | undefined>(false, { alias: 'isLoading' });
  readonly selectedRoleId = input<number | null>(null, { alias: 'selectedRoleId' });
  /** El usuario puede guardar permisos de un rol (roles-permissions:assign-permissions). */
  readonly canAssign = input(false);

  readonly togglePermission = output<{ permissionId: number; assigned: boolean }>();

  readonly expandedModuleIds = signal<Set<number>>(new Set());

  readonly $allExpanded = computed(() => this.expandedModuleIds().size === this.$modules().length);

  /** Por módulo: "Ver módulo" primero y, en cada permiso, si se puede cambiar o por qué no. */
  readonly $view = computed(() => {
    const canAssign = this.canAssign();
    return this.$modules().map((module) => {
      const locked = !this.#access.moduleInPlan(module.moduleCode);
      const permissions = [...module.permissions]
        .sort((a, b) => Number(b.code.endsWith(':see-module')) - Number(a.code.endsWith(':see-module')))
        .map((permission) => {
          const reason: LockReason = !canAssign
            ? 'read_only'
            : locked
              ? 'plan'
              : !this.#access.owns(permission.code)
                ? 'not_owned'
                : null;
          return { ...permission, reason, hint: reason ? LOCK_HINTS[reason] : '' };
        });
      return { ...module, locked, permissions };
    });
  });

  toggleAll(expanded: boolean) {
    if (expanded) {
      this.expandedModuleIds.set(new Set(this.$modules().map((m) => m.moduleId)));
    } else {
      this.expandedModuleIds.set(new Set());
    }
  }

  toggleModule(moduleId: number) {
    this.expandedModuleIds.update((set) => {
      const next = new Set(set);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  onToggle(permissionId: number, assigned: boolean) {
    this.togglePermission.emit({ permissionId, assigned });
  }
}
