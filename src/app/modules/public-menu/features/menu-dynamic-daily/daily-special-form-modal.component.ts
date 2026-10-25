import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { formatMenuPrice, MenuDailySpecialDto, MenuDynamicService, SaveMenuDailySpecialDto } from 'src/app/modules/public-menu/data-access';
import {
  addDays,
  dynamicInvalidField,
  dynamicSaveError,
  formatShortDay,
  joinIso,
  MenuDynamicCatalog,
  MenuDynamicItemsSelectComponent,
  overlapDailySpecialId,
  portionsSoldMessage,
  portionsSoldOf,
  splitIso,
  todayIn,
  toMinutes,
} from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService, ToggleComponent } from 'src/ui';

export type DailySpecialFormModalData = Readonly<{
  special?: MenuDailySpecialDto;
  locationId: number;
  timeZone: string | null;
  catalog: Signal<MenuDynamicCatalog | null>;
  catalogLoading: Signal<boolean>;
  /** Platos del día de la lista, para nombrar el que choca. */
  specials: readonly MenuDailySpecialDto[];
  /** Marca en la lista el plato del día con el que choca (null = ninguno). */
  onConflict: (dailySpecialId: number | null) => void;
}>;

type DailyPayload = SaveMenuDailySpecialDto & { productId: number; startsAt: string; endsAt: string };

type Field = 'product' | 'variation' | 'title' | 'note' | 'price' | 'portions' | 'time' | 'overlap';

export const DEFAULT_DAILY_TITLE = 'Plato del día';
const TITLE_MAX = 60;
const NOTE_MAX = 160;

const BACKEND_FIELDS: Readonly<Record<string, Field>> = {
  productId: 'product',
  variationId: 'variation',
  title: 'title',
  note: 'note',
  price: 'price',
  portions: 'portions',
  startsAt: 'time',
  endsAt: 'time',
};

/** Crear o editar el plato del día de un local. Devuelve el guardado (undefined = cancelado). */
@Component({
  selector: 'app-daily-special-form-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective, ToggleComponent, MenuDynamicItemsSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-special-form-modal.component.html',
})
export class DailySpecialFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<DailySpecialFormModalComponent, MenuDailySpecialDto>>(MatDialogRef);
  readonly data = inject<DailySpecialFormModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(MenuDynamicService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly special = this.data.special ?? null;
  readonly titleMax = TITLE_MAX;
  readonly noteMax = NOTE_MAX;
  readonly #start = splitIso(this.special?.startsAt, this.data.timeZone);
  readonly #end = splitIso(this.special?.endsAt, this.data.timeZone);

  readonly $productIds = signal<number[]>(this.special ? [this.special.productId] : []);
  readonly $variationId = signal<number | null>(this.special?.variationId ?? null);
  readonly $title = signal(this.special?.title ?? DEFAULT_DAILY_TITLE);
  readonly $note = signal(this.special?.note ?? '');
  readonly $price = signal<string>(this.special?.price != null ? String(this.special.price) : '');
  readonly $portions = signal<string>(this.special?.portions != null ? String(this.special.portions) : '');
  readonly $date = signal(this.special ? this.#start.date : todayIn(this.data.timeZone));
  readonly $startTime = signal(this.special ? this.#start.time : '12:00');
  readonly $endTime = signal(this.special ? this.#end.time : '16:00');
  readonly $isActive = signal(this.special?.isActive ?? true);

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $serverField = signal<Field | null>(null);
  /** Porciones ya vendidas según el backend (al bajar portions por debajo). */
  readonly $serverSold = signal<number | null>(null);
  readonly $conflict = signal<MenuDailySpecialDto | null>(null);
  /** Con porciones vendidas el producto ya no puede cambiar. */
  readonly productLocked = (this.special?.portionsSold ?? 0) > 0;

  readonly $product = computed(() => {
    const id = this.$productIds()[0];
    return id ? (this.data.catalog()?.productById.get(id) ?? null) : null;
  });
  readonly $variations = computed(() => this.$product()?.variations ?? []);
  readonly $catalogPrice = computed(() => {
    const variations = this.$variations();
    const chosen = variations.find((variation) => variation.id === this.$variationId());
    if (chosen?.price != null) return formatMenuPrice(chosen.price);
    return this.$product()?.priceLabel ?? null;
  });
  readonly $crossesMidnight = computed(() => /^\d{2}:\d{2}$/.test(this.$startTime()) && /^\d{2}:\d{2}$/.test(this.$endTime()) && toMinutes(this.$endTime()) < toMinutes(this.$startTime()));
  readonly $dateLabel = computed(() => (this.$date() ? formatShortDay(this.$date(), this.data.timeZone) : ''));
  readonly $problems = computed(() => this.#problems());

  show(field: Field): string | null {
    const message = this.$problems()[field] ?? null;
    if (!message) return null;
    return this.$submitted() || field === 'time' || field === 'price' || field === 'portions' || field === 'overlap' ? message : null;
  }

  setProduct(ids: number[]) {
    this.$productIds.set(ids);
    this.$variationId.set(null);
    this.#clear('product');
  }

  setVariation(raw: string) {
    this.$variationId.set(raw ? Number(raw) : null);
    this.#clear('variation');
  }

  setText(field: 'title' | 'note' | 'price' | 'portions', value: string) {
    ({ title: this.$title, note: this.$note, price: this.$price, portions: this.$portions })[field].set(value);
    this.#clear(field);
  }

  setTime(which: 'date' | 'start' | 'end', value: string) {
    ({ date: this.$date, start: this.$startTime, end: this.$endTime })[which].set(value);
    this.#clear('time');
    this.#clearConflict();
  }

  setActive(value: boolean) {
    this.$isActive.set(value);
    this.#clearConflict();
  }

  handleClose() {
    this.data.onConflict(null);
    this.dialogRef.close();
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) {
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    const dto = this.#dto();
    let request: Observable<MenuDailySpecialDto>;
    if (this.special) {
      const changes = this.#changes(this.special, dto);
      if (!Object.keys(changes).length) {
        this.dialogRef.close();
        return;
      }
      request = this.#service.updateDailySpecial(this.special.id, changes);
    } else {
      request = this.#service.createDailySpecial({ ...dto, locationId: this.data.locationId });
    }
    this.$isSaving.set(true);
    request.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (saved) => {
        this.data.onConflict(null);
        this.#toast.show(this.special ? 'Plato del día actualizado' : 'Plato del día creado', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const field = dynamicInvalidField(error);
        if (field) this.$serverField.set(BACKEND_FIELDS[field] ?? null);
        this.$serverSold.set(portionsSoldOf(error));
        const conflictId = overlapDailySpecialId(error);
        if (conflictId !== null) {
          this.$conflict.set(this.data.specials.find((item) => item.id === conflictId) ?? null);
          this.$serverField.set('overlap');
          this.data.onConflict(conflictId);
        }
        const message = dynamicSaveError(error, 'No se pudo guardar el plato del día.', this.data.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  #clear(field: Field) {
    if (this.$serverField() === field) this.$serverField.set(null);
    if (field === 'portions') this.$serverSold.set(null);
  }

  #clearConflict() {
    if (this.$serverField() !== 'overlap') return;
    this.$serverField.set(null);
    this.$conflict.set(null);
    this.data.onConflict(null);
  }

  #number(raw: string): number | null {
    const trimmed = raw.trim();
    return trimmed === '' ? null : Number(trimmed);
  }

  #problems(): Partial<Record<Field, string>> {
    const problems: Partial<Record<Field, string>> = {};
    if (!this.$productIds().length) problems.product = 'Elige el producto.';
    const title = this.$title().trim();
    if (!title) problems.title = 'Escribe un título.';
    else if (title.length > TITLE_MAX) problems.title = `Hasta ${TITLE_MAX} caracteres.`;
    if (this.$note().trim().length > NOTE_MAX) problems.note = `Hasta ${NOTE_MAX} caracteres.`;
    const price = this.#number(this.$price());
    if (price !== null && (!Number.isInteger(price) || price <= 0)) problems.price = 'Un monto entero en CLP mayor que 0.';
    const portions = this.#number(this.$portions());
    const sold = Math.max(this.special?.portionsSold ?? 0, this.$serverSold() ?? 0);
    if (portions !== null && (!Number.isInteger(portions) || portions < 1)) problems.portions = 'Un número entero desde 1.';
    else if (portions !== null && portions < sold) problems.portions = portionsSoldMessage(sold);
    else if (this.$serverSold() !== null) problems.portions = portionsSoldMessage(this.$serverSold()!);
    if (!this.$date() || !/^\d{2}:\d{2}$/.test(this.$startTime()) || !/^\d{2}:\d{2}$/.test(this.$endTime())) problems.time = 'Indica el día y el horario.';
    else if (this.$startTime() === this.$endTime()) problems.time = 'La hora de término debe ser distinta a la de inicio.';
    const server = this.$serverField();
    if (server === 'overlap') {
      const conflict = this.$conflict();
      problems.overlap = conflict
        ? `Se cruza con "${conflict.title}" (${formatShortDay(splitIso(conflict.startsAt, this.data.timeZone).date, this.data.timeZone)}, ${splitIso(conflict.startsAt, this.data.timeZone).time} a ${splitIso(conflict.endsAt, this.data.timeZone).time}). Cambia el horario o desactiva uno de los dos.`
        : 'Ya hay un plato del día activo en ese horario. Cambia el horario o desactiva el otro.';
    } else if (server && !problems[server]) problems[server] = 'El servidor rechazó este valor. Revísalo.';
    return problems;
  }

  #dto(): DailyPayload {
    const zone = this.data.timeZone;
    const endDate = this.$crossesMidnight() ? addDays(this.$date(), 1) : this.$date();
    return {
      productId: this.$productIds()[0],
      variationId: this.$variations().length > 1 ? this.$variationId() : null,
      title: this.$title().trim(),
      note: this.$note().trim() || null,
      price: this.#number(this.$price()),
      portions: this.#number(this.$portions()),
      startsAt: joinIso(this.$date(), this.$startTime(), zone)!,
      endsAt: joinIso(endDate, this.$endTime(), zone)!,
      isActive: this.$isActive(),
    };
  }

  /** Solo lo que cambió. */
  #changes(special: MenuDailySpecialDto, dto: DailyPayload): SaveMenuDailySpecialDto {
    const changes: Record<string, unknown> = {};
    if (dto.productId !== special.productId) changes['productId'] = dto.productId;
    if (dto.variationId !== special.variationId) changes['variationId'] = dto.variationId;
    if (dto.title !== special.title) changes['title'] = dto.title;
    if (dto.note !== special.note) changes['note'] = dto.note;
    if (dto.price !== special.price) changes['price'] = dto.price;
    if (dto.portions !== special.portions) changes['portions'] = dto.portions;
    const timeChanged = this.$date() !== this.#start.date || this.$startTime() !== this.#start.time || this.$endTime() !== this.#end.time;
    if (timeChanged) Object.assign(changes, { startsAt: dto.startsAt, endsAt: dto.endsAt });
    if (dto.isActive !== special.isActive) changes['isActive'] = dto.isActive;
    return changes as SaveMenuDailySpecialDto;
  }
}

export function openDailySpecialFormModal(dialog: MatDialog, data: DailySpecialFormModalData): Observable<MenuDailySpecialDto | undefined> {
  return dialog
    .open<DailySpecialFormModalComponent, DailySpecialFormModalData, MenuDailySpecialDto>(DailySpecialFormModalComponent, {
      width: '600px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
