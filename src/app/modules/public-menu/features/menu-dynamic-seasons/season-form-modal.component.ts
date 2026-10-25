import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { BannerDto, MenuDynamicService, MenuSeasonDto, SaveMenuSeasonDto } from 'src/app/modules/public-menu/data-access';
import {
  dynamicInvalidField,
  dynamicSaveError,
  endOfDayIso,
  formatShortDay,
  joinIso,
  MenuDynamicCatalog,
  MenuDynamicItemsSelectComponent,
  splitIso,
  todayIn,
} from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService, ToggleComponent } from 'src/ui';
import { SeasonPreset, seasonPresets } from './season-format';

export type SeasonFormModalData = Readonly<{
  season?: MenuSeasonDto;
  locationId: number;
  locationName: string;
  timeZone: string | null;
  catalog: Signal<MenuDynamicCatalog | null>;
  catalogLoading: Signal<boolean>;
  /** null = el plan no incluye banners (no se ofrece el enlace). */
  banners: Signal<readonly BannerDto[] | null>;
}>;

type Field = 'name' | 'dates' | 'title' | 'products' | 'banner';

const NAME_MAX = 60;
const TITLE_MAX = 60;

const BACKEND_FIELDS: Readonly<Record<string, Field>> = {
  name: 'name',
  startsAt: 'dates',
  endsAt: 'dates',
  title: 'title',
  productIds: 'products',
  bannerId: 'banner',
};

/** Crear o editar una temporada. Devuelve la guardada (undefined = cancelado). */
@Component({
  selector: 'app-season-form-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective, ToggleComponent, MenuDynamicItemsSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './season-form-modal.component.html',
})
export class SeasonFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<SeasonFormModalComponent, MenuSeasonDto>>(MatDialogRef);
  readonly data = inject<SeasonFormModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(MenuDynamicService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly season = this.data.season ?? null;
  readonly nameMax = NAME_MAX;
  readonly titleMax = TITLE_MAX;
  readonly presets = seasonPresets(todayIn(this.data.timeZone));
  readonly #original = {
    startDate: splitIso(this.season?.startsAt, this.data.timeZone).date,
    endDate: splitIso(this.season?.endsAt, this.data.timeZone).date,
  };

  readonly $name = signal(this.season?.name ?? '');
  readonly $allLocations = signal(this.season ? this.season.locationId === null : false);
  readonly $startDate = signal(this.#original.startDate);
  readonly $endDate = signal(this.#original.endDate);
  readonly $title = signal(this.season?.title ?? '');
  readonly $productIds = signal<number[]>([...(this.season?.productIds ?? [])]);
  readonly $bannerId = signal<number | null>(this.season?.bannerId ?? null);
  readonly $isActive = signal(this.season?.isActive ?? true);

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $serverField = signal<Field | null>(null);
  readonly $problems = computed(() => this.#problems());
  readonly $rangeLabel = computed(() => {
    const start = this.$startDate();
    const end = this.$endDate();
    if (!start || !end || end < start) return null;
    return `Del ${formatShortDay(start, this.data.timeZone)} al ${formatShortDay(end, this.data.timeZone)}, en la hora del negocio.`;
  });
  readonly $banners = computed(() => {
    const banners = this.data.banners();
    if (!banners) return null;
    // Solo los banners que se ven en este local (o en todos).
    return banners.filter((banner) => banner.locationId === null || banner.locationId === this.data.locationId || banner.id === this.$bannerId());
  });

  show(field: Field): string | null {
    const message = this.$problems()[field] ?? null;
    if (!message) return null;
    const editedDates = field === 'dates' && !!this.$startDate() && !!this.$endDate();
    return this.$submitted() || editedDates ? message : null;
  }

  applyPreset(preset: SeasonPreset) {
    this.$name.set(preset.name);
    if (!this.$title().trim()) this.$title.set(preset.title);
    this.$startDate.set(preset.startDate);
    this.$endDate.set(preset.endDate);
    this.$serverField.set(null);
  }

  setName(value: string) {
    this.$name.set(value);
    this.#clear('name');
  }

  setDate(which: 'start' | 'end', value: string) {
    (which === 'start' ? this.$startDate : this.$endDate).set(value);
    this.#clear('dates');
  }

  setTitle(value: string) {
    this.$title.set(value);
    this.#clear('title');
  }

  setProducts(ids: number[]) {
    this.$productIds.set(ids);
    this.#clear('products');
  }

  setBanner(raw: string) {
    this.$bannerId.set(raw ? Number(raw) : null);
    this.#clear('banner');
  }

  #clear(field: Field) {
    if (this.$serverField() === field) this.$serverField.set(null);
  }

  handleClose() {
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
    let request: Observable<MenuSeasonDto>;
    if (this.season) {
      const changes = this.#changes(this.season, dto);
      if (!Object.keys(changes).length) {
        this.dialogRef.close();
        return;
      }
      request = this.#service.updateSeason(this.season.id, changes);
    } else {
      request = this.#service.createSeason(dto);
    }
    this.$isSaving.set(true);
    request.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (saved) => {
        this.#toast.show(this.season ? 'Temporada actualizada' : 'Temporada creada', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const field = dynamicInvalidField(error);
        if (field) this.$serverField.set(BACKEND_FIELDS[field] ?? null);
        const message = dynamicSaveError(error, 'No se pudo guardar la temporada.', this.data.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  #problems(): Partial<Record<Field, string>> {
    const problems: Partial<Record<Field, string>> = {};
    const name = this.$name().trim();
    if (!name) problems.name = 'Escribe el nombre de la temporada.';
    else if (name.length > NAME_MAX) problems.name = `Hasta ${NAME_MAX} caracteres.`;
    const start = this.$startDate();
    const end = this.$endDate();
    if (!start || !end) problems.dates = 'Indica la fecha de inicio y la de término.';
    else if (end < start) problems.dates = 'La fecha de término no puede ser anterior a la de inicio.';
    if (this.$title().trim().length > TITLE_MAX) problems.title = `Hasta ${TITLE_MAX} caracteres.`;
    if (!this.$productIds().length && this.$bannerId() === null) problems.products = 'Elige al menos un producto (o un banner para activar).';
    const server = this.$serverField();
    if (server && !problems[server]) problems[server] = 'El servidor rechazó este valor. Revísalo.';
    return problems;
  }

  #dto(): SaveMenuSeasonDto {
    const zone = this.data.timeZone;
    return {
      locationId: this.$allLocations() ? null : this.data.locationId,
      name: this.$name().trim(),
      startsAt: joinIso(this.$startDate(), '00:00', zone) ?? undefined,
      endsAt: endOfDayIso(this.$endDate(), zone) ?? undefined,
      title: this.$title().trim() || null,
      productIds: this.$productIds(),
      bannerId: this.$bannerId(),
      isActive: this.$isActive(),
    };
  }

  /** Solo lo que cambió. */
  #changes(season: MenuSeasonDto, dto: SaveMenuSeasonDto): SaveMenuSeasonDto {
    const changes: Record<string, unknown> = {};
    if (dto.locationId !== season.locationId) changes['locationId'] = dto.locationId;
    if (dto.name !== season.name) changes['name'] = dto.name;
    if (this.$startDate() !== this.#original.startDate || this.$endDate() !== this.#original.endDate) Object.assign(changes, { startsAt: dto.startsAt, endsAt: dto.endsAt });
    if (dto.title !== season.title) changes['title'] = dto.title;
    if ((dto.productIds ?? []).join() !== season.productIds.join()) changes['productIds'] = dto.productIds;
    if (dto.bannerId !== season.bannerId) changes['bannerId'] = dto.bannerId;
    if (dto.isActive !== season.isActive) changes['isActive'] = dto.isActive;
    return changes as SaveMenuSeasonDto;
  }
}

export function openSeasonFormModal(dialog: MatDialog, data: SeasonFormModalData): Observable<MenuSeasonDto | undefined> {
  return dialog
    .open<SeasonFormModalComponent, SeasonFormModalData, MenuSeasonDto>(SeasonFormModalComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
