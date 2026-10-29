import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { CartaIcon, CartaIconName } from 'src/app/modules/public-menu/carta/ui/carta-icon';
import { DAY_SHORT, formatTime, MENU_CATEGORY_ICONS, MenuDynamicService, MenuMomentDto, MenuMomentMode, SaveMenuMomentDto } from 'src/app/modules/public-menu/data-access';
import { crossesMidnight, formatDays, WEEK_ORDER } from 'src/app/modules/public-menu/features/marketing-schedule-field';
import {
  dynamicInvalidField,
  dynamicSaveError,
  MenuDynamicCatalog,
  MenuDynamicItemsSelectComponent,
  overlapMomentId,
} from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService, ToggleComponent } from 'src/ui';
import { findOverlap, MOMENT_MODE_HINTS, MOMENT_MODE_LABELS, MOMENT_PRESETS, MomentPreset } from './moment-format';

export type MomentFormModalData = Readonly<{
  moment?: MenuMomentDto;
  locationId: number;
  /** Momentos del local, para avisar si el horario se cruza con otro. */
  moments: readonly MenuMomentDto[];
  catalog: Signal<MenuDynamicCatalog | null>;
  catalogLoading: Signal<boolean>;
  /** Marca en la lista el momento con el que choca (null = ninguno). */
  onConflict: (momentId: number | null) => void;
}>;

type MomentPayload = Required<Omit<SaveMenuMomentDto, 'locationId'>>;

type Field = 'name' | 'icon' | 'days' | 'time' | 'mode' | 'items' | 'overlap';

const NAME_MAX = 40;
const MODES: MenuMomentMode[] = ['highlight', 'only'];

const BACKEND_FIELDS: Readonly<Record<string, Field>> = {
  name: 'name',
  icon: 'icon',
  days: 'days',
  startTime: 'time',
  endTime: 'time',
  mode: 'mode',
  categoryIds: 'items',
  productIds: 'items',
};

/** Crear o editar un momento del día. Devuelve el guardado (undefined = cancelado). */
@Component({
  selector: 'app-moment-form-modal',
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToggleComponent, CartaIcon, MenuDynamicItemsSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './moment-form-modal.component.html',
})
export class MomentFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<MomentFormModalComponent, MenuMomentDto>>(MatDialogRef);
  readonly data = inject<MomentFormModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(MenuDynamicService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly moment = this.data.moment ?? null;
  readonly nameMax = NAME_MAX;
  readonly modes = MODES;
  readonly modeLabels = MOMENT_MODE_LABELS;
  readonly modeHints = MOMENT_MODE_HINTS;
  readonly presets = MOMENT_PRESETS;
  readonly icons = MENU_CATEGORY_ICONS;
  readonly weekOrder = WEEK_ORDER;
  readonly dayShort = DAY_SHORT;
  readonly asIcon = (name: string) => name as CartaIconName;

  readonly $name = signal(this.moment?.name ?? '');
  readonly $icon = signal<string | null>(this.moment?.icon ?? null);
  readonly $days = signal<number[]>([...(this.moment?.days ?? [1, 2, 3, 4, 5])]);
  readonly $startTime = signal(this.moment ? formatTime(this.moment.startTime) : '12:00');
  readonly $endTime = signal(this.moment ? formatTime(this.moment.endTime) : '15:30');
  readonly $mode = signal<MenuMomentMode>(this.moment?.mode ?? 'highlight');
  readonly $categoryIds = signal<number[]>([...(this.moment?.categoryIds ?? [])]);
  readonly $productIds = signal<number[]>([...(this.moment?.productIds ?? [])]);
  readonly $isActive = signal(this.moment?.isActive ?? true);

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $touchedName = signal(false);
  /** Rechazo del backend: campo marcado o momento con el que choca. */
  readonly $serverField = signal<Field | null>(null);
  readonly $serverConflictId = signal<number | null>(null);

  readonly $crossesMidnight = computed(() => crossesMidnight(this.$startTime(), this.$endTime()));
  readonly $daysLabel = computed(() => formatDays(this.$days()));
  readonly $conflict = computed(() => {
    const serverId = this.$serverConflictId();
    if (serverId !== null) return this.data.moments.find((moment) => moment.id === serverId) ?? null;
    if (!this.$isActive() || this.#timeProblem() || !this.$days().length) return null;
    return findOverlap(this.data.moments, { days: this.$days(), startTime: this.$startTime(), endTime: this.$endTime() }, this.moment?.id ?? null);
  });
  readonly $problems = computed(() => this.#problems());

  show(field: Field): string | null {
    const message = this.$problems()[field] ?? null;
    if (!message) return null;
    if (this.$submitted() || field === 'overlap' || field === 'time') return message;
    if (field === 'name') return this.$touchedName() ? message : null;
    return null;
  }

  applyPreset(preset: MomentPreset) {
    this.$name.set(preset.name);
    this.$icon.set(preset.icon);
    this.$startTime.set(preset.startTime);
    this.$endTime.set(preset.endTime);
    this.$days.set([...preset.days]);
    this.#edited();
  }

  toggleDay(day: number) {
    this.$days.update((days) => (days.includes(day) ? days.filter((item) => item !== day) : [...days, day]));
    this.#edited();
  }

  setName(value: string) {
    this.$name.set(value);
    if (this.$serverField() === 'name') this.$serverField.set(null);
  }

  setTime(which: 'start' | 'end', value: string) {
    (which === 'start' ? this.$startTime : this.$endTime).set(value);
    this.#edited();
  }

  setActive(value: boolean) {
    this.$isActive.set(value);
    this.#edited();
  }

  setItems(kind: 'category' | 'product', ids: number[]) {
    (kind === 'category' ? this.$categoryIds : this.$productIds).set(ids);
    if (this.$serverField() === 'items') this.$serverField.set(null);
  }

  setIcon(icon: string | null) {
    this.$icon.set(icon);
    if (this.$serverField() === 'icon') this.$serverField.set(null);
  }

  setMode(mode: MenuMomentMode) {
    this.$mode.set(mode);
    if (this.$serverField() === 'mode') this.$serverField.set(null);
  }

  handleClose() {
    this.data.onConflict(null);
    this.dialogRef.close();
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) {
      this.$touchedName.set(true);
      this.data.onConflict(this.$conflict()?.id ?? null);
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    const dto = this.#dto();
    let request: Observable<MenuMomentDto>;
    if (this.moment) {
      const changes = this.#changes(this.moment, dto);
      if (!Object.keys(changes).length) {
        this.dialogRef.close();
        return;
      }
      request = this.#service.updateMoment(this.moment.id, changes);
    } else {
      request = this.#service.createMoment({ ...dto, locationId: this.data.locationId });
    }
    this.$isSaving.set(true);
    request.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (saved) => {
        this.data.onConflict(null);
        this.#toast.show(this.moment ? 'Momento actualizado' : 'Momento creado', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const conflictId = overlapMomentId(error);
        if (conflictId !== null) {
          this.$serverConflictId.set(conflictId);
          this.data.onConflict(conflictId);
        }
        const field = dynamicInvalidField(error);
        if (field) this.$serverField.set(BACKEND_FIELDS[field] ?? null);
        const message = dynamicSaveError(error, 'No se pudo guardar el momento.', this.data.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  #edited() {
    if (this.$serverConflictId() !== null) {
      this.$serverConflictId.set(null);
      this.data.onConflict(null);
    }
    if (this.$serverField() === 'time' || this.$serverField() === 'days') this.$serverField.set(null);
  }

  #timeProblem(): string | null {
    const start = this.$startTime();
    const end = this.$endTime();
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return 'Indica la hora de inicio y la de término.';
    if (start === end) return 'La hora de término debe ser distinta a la de inicio.';
    return null;
  }

  #problems(): Partial<Record<Field, string>> {
    const problems: Partial<Record<Field, string>> = {};
    const name = this.$name().trim();
    if (!name) problems.name = 'Escribe el nombre del momento.';
    else if (name.length > NAME_MAX) problems.name = `Hasta ${NAME_MAX} caracteres.`;
    if (!this.$days().length) problems.days = 'Elige al menos un día.';
    const time = this.#timeProblem();
    if (time) problems.time = time;
    if (!this.$categoryIds().length && !this.$productIds().length) problems.items = 'Elige al menos una categoría o un producto.';
    const conflict = this.$conflict();
    if (conflict) problems.overlap = `Se cruza con "${conflict.name}" (${formatDays(conflict.days)} · ${formatTime(conflict.startTime)} a ${formatTime(conflict.endTime)}). Cambia el horario o desactiva uno de los dos.`;
    const server = this.$serverField();
    if (server && !problems[server]) problems[server] = 'El servidor rechazó este valor. Revísalo.';
    return problems;
  }

  #dto(): MomentPayload {
    return {
      name: this.$name().trim(),
      icon: this.$icon(),
      days: [...this.$days()].sort((a, b) => a - b),
      startTime: this.$startTime(),
      endTime: this.$endTime(),
      mode: this.$mode(),
      categoryIds: this.$categoryIds(),
      productIds: this.$productIds(),
      isActive: this.$isActive(),
    };
  }

  /** Solo lo que cambió. */
  #changes(moment: MenuMomentDto, dto: MomentPayload): SaveMenuMomentDto {
    const changes: Record<string, unknown> = {};
    const same = (a: readonly number[], b: readonly number[]) => a.join() === b.join();
    if (dto.name !== moment.name) changes['name'] = dto.name;
    if (dto.icon !== moment.icon) changes['icon'] = dto.icon;
    if (!same(dto.days, [...moment.days].sort((a, b) => a - b))) changes['days'] = dto.days;
    if (dto.startTime !== formatTime(moment.startTime) || dto.endTime !== formatTime(moment.endTime)) Object.assign(changes, { startTime: dto.startTime, endTime: dto.endTime });
    if (dto.mode !== moment.mode) changes['mode'] = dto.mode;
    if (!same(dto.categoryIds, moment.categoryIds)) changes['categoryIds'] = dto.categoryIds;
    if (!same(dto.productIds, moment.productIds)) changes['productIds'] = dto.productIds;
    if (dto.isActive !== moment.isActive) changes['isActive'] = dto.isActive;
    return changes as SaveMenuMomentDto;
  }
}

export function openMomentFormModal(dialog: MatDialog, data: MomentFormModalData): Observable<MenuMomentDto | undefined> {
  return dialog
    .open<MomentFormModalComponent, MomentFormModalData, MenuMomentDto>(MomentFormModalComponent, {
      width: '680px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
