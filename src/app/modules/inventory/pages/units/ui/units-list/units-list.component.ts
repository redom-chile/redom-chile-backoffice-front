import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from 'src/ui';
import { formatQuantity, UnitDto } from '../../../../data-access';

type UnitGroup = Readonly<{ base: UnitDto; subunits: UnitDto[] }>;

/** Unidades agrupadas: cada unidad base con sus subunidades ("1 Kilogramo = 1000 g"). */
@Component({
  selector: 'app-units-list',
  imports: [NgTemplateOutlet, IconComponent],
  template: `
    <div class="space-y-3">
      @for (group of $groups(); track group.base.id) {
      <div class="glass overflow-hidden rounded-[1rem]">
        <div class="flex items-center gap-3 px-4 py-3">
          <span class="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <app-icon class="h-5 w-5">straighten</app-icon>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-foreground font-semibold">
              {{ group.base.actualName }} <span class="text-muted-foreground font-normal">({{ group.base.shortName }})</span>
            </p>
            <p class="text-muted-foreground text-xs">
              Unidad base · {{ group.base.allowDecimal ? 'Permite decimales' : 'Solo números enteros' }}
            </p>
          </div>
          <ng-container *ngTemplateOutlet="actions; context: { $implicit: group.base }" />
        </div>
        @for (sub of group.subunits; track sub.id) {
        <div class="flex items-center gap-3 border-t border-dashed border-[var(--border)] py-2.5 pl-8 pr-4 sm:pl-16">
          <app-icon class="text-muted-foreground h-4 w-4 shrink-0">subdirectory_arrow_right</app-icon>
          <div class="min-w-0 flex-1">
            <p class="text-foreground text-sm font-medium">
              1 {{ sub.actualName }} = {{ equivalence(sub, group.base) }}
            </p>
            <p class="text-muted-foreground text-xs">
              {{ sub.shortName }} · {{ sub.allowDecimal ? 'Permite decimales' : 'Solo números enteros' }}
            </p>
          </div>
          <ng-container *ngTemplateOutlet="actions; context: { $implicit: sub }" />
        </div>
        }
      </div>
      }
    </div>

    <ng-template #actions let-unit>
      <div class="flex shrink-0 gap-1">
        <button
          type="button"
          title="Editar"
          [attr.aria-label]="'Editar ' + unit.actualName"
          class="text-muted-foreground hover:text-primary inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--muted)]/30"
          (click)="edit.emit(unit)">
          <app-icon class="h-5 w-5">edit</app-icon>
        </button>
        <button
          type="button"
          title="Eliminar"
          [attr.aria-label]="'Eliminar ' + unit.actualName"
          class="text-muted-foreground inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-red-500/10 hover:text-red-600"
          (click)="delete.emit(unit)">
          <app-icon class="h-5 w-5">delete</app-icon>
        </button>
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnitsListComponent {
  readonly units = input.required<readonly UnitDto[]>();
  readonly edit = output<UnitDto>();
  readonly delete = output<UnitDto>();

  readonly $groups = computed<UnitGroup[]>(() => {
    const units = this.units();
    const ids = new Set(units.map((unit) => unit.id));
    // Una subunidad cuya base ya no existe se muestra como unidad base.
    const isBase = (unit: UnitDto) => !unit.baseUnitId || !ids.has(unit.baseUnitId);
    return units
      .filter(isBase)
      .sort((a, b) => a.actualName.localeCompare(b.actualName, 'es'))
      .map((base) => ({
        base,
        subunits: units
          .filter((unit) => !isBase(unit) && unit.baseUnitId === base.id)
          .sort((a, b) => Number(a.baseUnitMultiplier) - Number(b.baseUnitMultiplier)),
      }));
  });

  equivalence(sub: UnitDto, base: UnitDto): string {
    return formatQuantity(Number(sub.baseUnitMultiplier), base.shortName);
  }
}
