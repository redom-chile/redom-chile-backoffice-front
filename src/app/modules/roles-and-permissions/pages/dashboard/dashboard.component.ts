import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardMenuRoutesDto } from 'src/app/core/dtos';
import { CardComponent, HeaderDashboardComponent } from 'src/ui';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PermissionCode, PERMISSIONS } from 'src/app/core/permissions';

type DashboardCard = CardMenuRoutesDto & { permission?: PermissionCode };

@Component({
  selector: 'app-dashboard',
  imports: [HeaderDashboardComponent, RouterLink, CardComponent, CheckPermissionDirective],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  principalCards: Array<DashboardCard>;

  constructor() {
    const basePath = 'roles-and-permissions';
    this.principalCards = [
      {
        name: 'Módulos',
        description: 'Gestiona los módulos para los permisos.',
        route: `modules`,
        permission: PERMISSIONS.MODULES.SEE_MODULE,
      },
      {
        name: 'Permisos',
        description: 'Gestiona los permisos existentes en el sistema.',
        route: `permissions`,
        permission: PERMISSIONS.PERMISSIONS.SEE_MODULE,
      },
      {
        name: 'Roles',
        description: 'Gestiona los roles que tendrá el sistema.',
        route: `roles`,
        permission: PERMISSIONS.ROLES.SEE_MODULE,
      },
      {
        name: 'Roles y permisos',
        description: 'Administra los roles y sus permisos respectivos.',
        route: `roles-permissions`,
        permission: PERMISSIONS.ROLES_PERMISSIONS.SEE_MODULE,
      },
      {
        name: 'Usuarios y roles',
        description: 'Gestiona los roles que tendrá cada usuario.',
        route: `roles-user`,
        permission: PERMISSIONS.USER_ROLES.SEE_MODULE,
      },
      {
        name: 'Usuarios',
        description: 'Gestiona los usuarios del sistema.',
        route: `users`,
        permission: PERMISSIONS.USERS.SEE_MODULE,
      },
    ];
  }
}
