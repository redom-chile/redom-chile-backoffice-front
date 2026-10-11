import { animate, style, transition, trigger } from '@angular/animations';
import { Component, computed, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { ButtonComponent, IconComponent, SlotDirective, ToggleComponent } from 'src/ui';
import { CardComponent } from 'src/ui/templates/single-card';
import { MatDialog } from '@angular/material/dialog';
import { ModulePermissionsDto } from '../../data-access';
import { UpdatePermissionModalComponent } from '../update-permission-modal';
import { DeletePermissionModalComponent } from '../delete-permission-modal';
import { PermissionsListSkeletonComponent } from '../../ui';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PERMISSIONS } from 'src/app/core/permissions';

@Component({
  selector: 'app-permissions-list',
  imports: [
    CardComponent,
    SlotDirective,
    ButtonComponent,
    IconComponent,
    ToggleComponent,
    PermissionsListSkeletonComponent,
    CheckPermissionDirective,
  ],
  templateUrl: './permissions-list.component.html',
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
export class PermissionsListComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  readonly $modules = input.required<ModulePermissionsDto[]>({ alias: 'modules' });
  readonly isLoading = input<boolean | undefined>(false, { alias: 'isLoading' });

  readonly expandedModuleIds = signal<Set<number>>(new Set());

  readonly $allExpanded = computed(() => this.expandedModuleIds().size === this.$modules().length);

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

  updatePermission(item: any) {
    this.dialog.open(UpdatePermissionModalComponent, {
      width: '90%',
      data: item,
    });
  }

  deletePermission(item: any) {
    this.dialog.open(DeletePermissionModalComponent, {
      width: '90%',
      data: item,
    });
  }
}
