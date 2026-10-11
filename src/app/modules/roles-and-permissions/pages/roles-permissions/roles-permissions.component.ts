import { Component, computed, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, ToastService } from 'src/ui';
import { GetAllPermissionsService } from '../permissions/data-access';
import { GetRolePermissionsService, AssignPermissionsService } from './data-access';
import { getRoleErrorMessage } from '../roles/data-access';
import { ActivatedRoute } from '@angular/router';
import { RoleSelectorComponent } from './ui';
import { RolesPermissionsCardComponent } from './features';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';

@Component({
  selector: 'app-roles-permissions',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    RoleSelectorComponent,
    RolesPermissionsCardComponent,
    CheckPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './roles-permissions.component.html',
})
export class RolesPermissionsComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  protected readonly $allPermissionsService = inject(GetAllPermissionsService);
  protected readonly $rolePermissionsService = inject(GetRolePermissionsService);
  private readonly assignService = inject(AssignPermissionsService);
  private readonly $toast = inject(ToastService);
  private readonly whoamiService = inject(WhoamiService);
  readonly #access = inject(AccessService);

  selectedRoleId = signal<number | null>(null);
  pendingPermissionIds = signal<Set<number>>(new Set());
  private rolePermissionsFetched = signal(false);
  private lastSavedRoleId = signal<number | null>(null);

  readonly $modules = this.$allPermissionsService.$filteredModules;
  readonly $permissionsLoading = computed(
    () => this.$allPermissionsService.$isLoading() || this.$rolePermissionsService.$isLoading(),
  );

  readonly $total = computed(() => {
    const modules = this.$modules();
    return modules.reduce((acc, m) => acc + m.permissions.length, 0);
  });

  readonly hasPendingChanges = computed(() => {
    const roleId = this.selectedRoleId();
    if (!roleId) return false;
    const serverIds = this.$rolePermissionsService.$rolePermissionIds();
    const pending = this.pendingPermissionIds();
    if (serverIds.size !== pending.size) return true;
    for (const id of serverIds) {
      if (!pending.has(id)) return true;
    }
    return false;
  });

  readonly $saving = this.assignService.$isLoading;
  /** Puede guardar: si no, la pantalla queda de solo lectura. */
  readonly $canAssign = computed(() => this.#access.can(PERMISSIONS.ROLES_PERMISSIONS.ASSIGN_PERMISSION));

  constructor() {
    effect(() => {
      if (this.assignService.$success() && this.lastSavedRoleId() !== null) {
        this.lastSavedRoleId.set(null);
        this.$toast.show('Permisos guardados.', 'success');
        // Si el usuario conectado tiene este rol, sus permisos cambiaron.
        this.whoamiService.refetch();
        this.retry();
      }
    });

    effect(() => {
      const error = this.assignService.$error();
      if (error) {
        const message = getRoleErrorMessage(error, 'No se pudieron guardar los permisos. Intenta nuevamente.');
        if (message) this.$toast.show(message, 'error');
      }
    });

    // El catálogo es compartido con la pantalla Permisos: aquí se ve completo.
    this.$allPermissionsService.setParams({ searchCode: '', searchName: '' });
    // Desde el botón "Permisos" de la tabla de roles llega el rol elegido.
    const roleId = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('roleId'));
    if (roleId) this.onRoleSelected(roleId);

    effect(() => {
      const roleId = this.selectedRoleId();
      const ids = this.$rolePermissionsService.$rolePermissionIds();
      const isLoading = this.$rolePermissionsService.$isLoading();

      if (roleId && !this.rolePermissionsFetched() && !isLoading) {
        this.pendingPermissionIds.set(new Set(ids));
        this.rolePermissionsFetched.set(true);
      }
    });
  }

  onRoleSelected(roleId: number) {
    this.selectedRoleId.set(roleId);
    this.pendingPermissionIds.set(new Set());
    this.rolePermissionsFetched.set(false);
    this.$rolePermissionsService.setRoleId(roleId);
  }

  onTogglePermission(event: { permissionId: number; assigned: boolean }) {
    this.pendingPermissionIds.update((pending) => {
      const next = new Set(pending);
      if (event.assigned) {
        next.add(event.permissionId);
      } else {
        next.delete(event.permissionId);
      }
      return next;
    });
  }

  savePermissions() {
    const roleId = this.selectedRoleId();
    if (!roleId) return;

    this.lastSavedRoleId.set(roleId);
    this.assignService.execute(roleId, [...this.pendingPermissionIds()]);
  }

  retry() {
    this.$allPermissionsService.retry();
    const roleId = this.selectedRoleId();
    if (roleId) {
      this.pendingPermissionIds.set(new Set());
      this.rolePermissionsFetched.set(false);
      this.$rolePermissionsService.setRoleId(roleId);
    }
  }
}
