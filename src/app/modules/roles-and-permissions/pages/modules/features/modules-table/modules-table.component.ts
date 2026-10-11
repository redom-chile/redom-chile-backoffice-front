import { Component, EventEmitter, inject, input, Output, ChangeDetectionStrategy } from '@angular/core';
import { GetAllModulesDto } from 'src/app/modules/roles-and-permissions/pages/modules/data-access';
import {
  ButtonComponent,
  IconComponent,
  PaginationTableComponent,
  ProgressBarComponent,
  SlotDirective,
  TableComponent,
} from 'src/ui';
import { MatDialog } from '@angular/material/dialog';
import { CreateNewModelModalComponent } from '../create-new-model-modal/create-new-model-modal.component';
import { FiltersTableModuleComponent } from '../../ui';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { UpdateModuleModalComponent } from '../update-module-modal/update-module-modal.component';
import { DeleteModuleModalComponent } from '../delete-module-modal/delete-module-modal.component';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PERMISSIONS } from 'src/app/core/permissions';

@Component({
  selector: 'app-modules-table',
  imports: [
    TableComponent,
    SlotDirective,
    ButtonComponent,
    IconComponent,
    PaginationTableComponent,
    ProgressBarComponent,
    FiltersTableModuleComponent,
    CheckPermissionDirective,
  ],
  templateUrl: './modules-table.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './modules-table.component.css',
})
export class ModulesTableComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  readonly $getAllModulesDetail = input.required<GetAllModulesDto[]>({
    alias: 'getAllModulesDetail',
  });

  searchCode = input<string>('', { alias: 'searchCode' });
  searchName = input<string>('', { alias: 'searchName' });
  isLoading = input<boolean | undefined>(false, { alias: 'isLoading' });

  @Output() pageChange = new EventEmitter<number>();
  @Output() filtersChanged = new EventEmitter<{ code: string; name: string }>();
  @Output() retryData = new EventEmitter<void>();

  readonly $pagination = input.required<PaginationMeta>({
    alias: 'pagination',
  });
  headerData = ['Id', 'Código', 'Nombre', 'Acción'];

  viewDetailModule() {
    this.dialog.open(CreateNewModelModalComponent, {
      width: '90%',
      data: {},
    });
  }

  updateModule(item: any) {
    this.dialog.open(UpdateModuleModalComponent, {
      width: '90%',
      data: item,
    });
  }
  deleteModule(item: any) {
    this.dialog.open(DeleteModuleModalComponent, {
      width: '90%',
      data: item,
    });
  }

  onChangePage(page: number) {
    this.pageChange.emit(page);
  }

  onSearchCodeChange(value: string) {
    this.filtersChanged.emit({ code: value, name: this.searchName() });
  }

  onSearchNameChange(value: string) {
    this.filtersChanged.emit({ code: this.searchCode(), name: value });
  }
  hola() {}

  retry() {
    this.retryData.emit();
  }
}
