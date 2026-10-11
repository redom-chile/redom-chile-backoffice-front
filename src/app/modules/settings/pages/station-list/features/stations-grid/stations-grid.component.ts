import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { StationDto } from '../../data-access';
import { stationTypeOption } from '../../ui';

@Component({
  selector: 'app-stations-grid',
  standalone: true,
  imports: [RouterLink, IconComponent, SkeletonComponent, CheckPermissionDirective],
  templateUrl: './stations-grid.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StationsGridComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  readonly stations = input.required<StationDto[]>();
  readonly loading = input(false);
  readonly printerNames = input<Record<number, string>>({});
  readonly locationNames = input<Record<number, string>>({});

  readonly manageProducts = output<StationDto>();
  readonly edit = output<StationDto>();
  readonly delete = output<StationDto>();

  readonly typeOption = stationTypeOption;
  readonly skeletons = [1, 2, 3];
}
