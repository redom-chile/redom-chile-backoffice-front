import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { GetAllRolesService } from '../../../roles/data-access';

@Component({
  selector: 'app-role-selector',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './role-selector.component.html',
})
export class RoleSelectorComponent {
  // Todos los roles sin tocar la vista paginada de la tabla de roles (comparten servicio).
  protected readonly $roles = toSignal(inject(GetAllRolesService).options());

  /** Rol elegido (ej. al llegar desde el botón "Permisos" de la tabla de roles). */
  readonly value = input<number | null>(null);
  selectedRoleChange = output<number>();

  onRoleChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    if (value) {
      this.selectedRoleChange.emit(value);
    }
  }
}
