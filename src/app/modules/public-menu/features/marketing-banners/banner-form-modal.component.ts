import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom, map, Observable, startWith } from 'rxjs';
import { FileUploadService, getUploadErrorMessage, ImageSelection, ImageUploadError } from 'src/app/core/services/file-upload';
import { BannerDto, BannerLinkType, BannerType, CreateBannerDto, MenuMarketingService, UpdateBannerDto } from 'src/app/modules/public-menu/data-access';
import {
  MarketingScheduleFieldComponent,
  sameSchedule,
  ScheduleFormValue,
  scheduleFromEntity,
  scheduleProblem,
  scheduleToDto,
} from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { MarketingLocation, marketingSaveError } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingTarget, MarketingTargetPickerComponent } from 'src/app/modules/public-menu/features/marketing-target-picker';
import { ButtonComponent, ImagePickerComponent, ModalCardComponent, SlotDirective, ToastService, ToggleComponent } from 'src/ui';
import { BANNER_LINK_LABELS, BANNER_TYPE_LABELS, BANNER_TYPES, URL_PATTERN } from './banner-format';

export type BannerFormModalData = Readonly<{
  banner?: BannerDto;
  /** Nombre del producto o categoría enlazado (al editar). */
  linkName?: string | null;
  locations: readonly MarketingLocation[];
  timeZone: string | null;
  locationId?: number | null;
}>;

type Field = 'title' | 'subtitle' | 'link' | 'schedule';
type Display = 'banner' | 'modal';

const TITLE_MAX = 120;
const SUBTITLE_MAX = 300;
const LINK_TYPES: BannerLinkType[] = ['none', 'product', 'category', 'url'];

/** Crear o editar un banner o la ventana de ofertas. Devuelve el guardado (undefined = cancelado). */
@Component({
  selector: 'app-banner-form-modal',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    ModalCardComponent,
    SlotDirective,
    ToggleComponent,
    ImagePickerComponent,
    MarketingScheduleFieldComponent,
    MarketingTargetPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './banner-form-modal.component.html',
})
export class BannerFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<BannerFormModalComponent, BannerDto>>(MatDialogRef);
  readonly data = inject<BannerFormModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(MenuMarketingService);
  readonly #upload = inject(FileUploadService);
  readonly #toast = inject(ToastService);
  readonly #fb = inject(FormBuilder);

  readonly banner = this.data.banner ?? null;
  readonly titleMax = TITLE_MAX;
  readonly subtitleMax = SUBTITLE_MAX;
  readonly types = BANNER_TYPES;
  readonly typeLabels = BANNER_TYPE_LABELS;
  readonly linkTypes = LINK_TYPES;
  readonly linkLabels = BANNER_LINK_LABELS;
  readonly $uploading = this.#upload.$isUploading;
  readonly $progress = this.#upload.$progress;

  readonly form = this.#fb.group({
    type: this.#fb.nonNullable.control<BannerType>(this.banner?.type ?? 'promotion'),
    title: this.#fb.nonNullable.control(this.banner?.title ?? ''),
    subtitle: this.#fb.nonNullable.control(this.banner?.subtitle ?? ''),
    display: this.#fb.nonNullable.control<Display>(this.banner?.display ?? 'banner'),
    linkType: this.#fb.nonNullable.control<BannerLinkType>(this.banner?.linkType ?? 'none'),
    linkUrl: this.#fb.nonNullable.control(this.banner?.linkUrl ?? ''),
    locationId: this.#fb.nonNullable.control<string>(String(this.banner ? (this.banner.locationId ?? '') : (this.data.locationId ?? ''))),
  });
  readonly $value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  readonly $linkTarget = signal<MarketingTarget | null>(
    this.banner?.linkId ? { id: this.banner.linkId, name: this.data.linkName ?? `#${this.banner.linkId}` } : null,
  );
  readonly $isActive = signal(this.banner?.isActive ?? true);
  readonly #image = signal<ImageSelection>({ kind: 'keep' });
  readonly #originalSchedule = scheduleFromEntity(this.banner, this.data.timeZone);
  readonly $schedule = signal<ScheduleFormValue>(this.#originalSchedule);

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $problems = computed(() => this.#problems());

  constructor() {
    this.form.controls.linkType.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.$linkTarget.set(null));
  }

  show(field: Field): string | null {
    const message = this.$problems()[field] ?? null;
    if (!message) return null;
    if (this.$submitted() || field === 'schedule') return message;
    if (field === 'title' || field === 'subtitle') return this.form.controls[field].touched ? message : null;
    if (field === 'link') return this.form.controls.linkUrl.touched ? message : null;
    return null;
  }

  onImage(selection: ImageSelection) {
    this.#image.set(selection);
  }

  handleClose() {
    this.dialogRef.close();
  }

  async handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    this.$isSaving.set(true);
    try {
      const imageFileId = await this.#upload.resolveSelection(this.#image(), 'menu_banners');
      let saved: BannerDto;
      if (this.banner) {
        const dto = this.#changes(this.banner, imageFileId);
        if (!Object.keys(dto).length) {
          this.dialogRef.close();
          return;
        }
        saved = await firstValueFrom(this.#service.updateBanner(this.banner.id, dto));
      } else {
        saved = await firstValueFrom(this.#service.createBanner(this.#createDto(imageFileId ?? null)));
      }
      this.#toast.show(this.banner ? 'Banner actualizado' : 'Banner creado', 'success');
      this.dialogRef.close(saved);
    } catch (error) {
      this.$isSaving.set(false);
      const message = error instanceof ImageUploadError ? getUploadErrorMessage(error) : marketingSaveError(error, 'No se pudo guardar el banner.');
      if (message) this.#toast.show(message, 'error');
    }
  }

  #problems(): Partial<Record<Field, string>> {
    const v = this.$value();
    const problems: Partial<Record<Field, string>> = {};
    const title = v.title.trim();
    if (!title) problems.title = 'Ingresa el título.';
    else if (title.length > TITLE_MAX) problems.title = `Hasta ${TITLE_MAX} caracteres.`;
    if (v.subtitle.trim().length > SUBTITLE_MAX) problems.subtitle = `Hasta ${SUBTITLE_MAX} caracteres.`;
    if ((v.linkType === 'product' || v.linkType === 'category') && !this.$linkTarget())
      problems.link = v.linkType === 'product' ? 'Elige el producto.' : 'Elige la categoría.';
    if (v.linkType === 'url' && !URL_PATTERN.test(v.linkUrl.trim())) problems.link = 'Ingresa una dirección que empiece con https://';
    const schedule = scheduleProblem(this.$schedule());
    if (schedule) problems.schedule = schedule;
    return problems;
  }

  #link(): Pick<CreateBannerDto, 'linkType' | 'linkId' | 'linkUrl'> {
    const v = this.$value();
    return {
      linkType: v.linkType,
      linkId: v.linkType === 'product' || v.linkType === 'category' ? this.$linkTarget()!.id : null,
      linkUrl: v.linkType === 'url' ? v.linkUrl.trim() : null,
    };
  }

  #locationId(): number | null {
    const raw = this.$value().locationId;
    return raw ? Number(raw) : null;
  }

  #createDto(imageFileId: string | null): CreateBannerDto {
    const v = this.$value();
    const schedule = scheduleToDto(this.$schedule(), this.data.timeZone);
    return {
      type: v.type,
      title: v.title.trim(),
      subtitle: v.subtitle.trim() || null,
      display: v.display,
      imageFileId,
      ...this.#link(),
      locationId: this.#locationId(),
      isActive: this.$isActive(),
      ...Object.fromEntries(Object.entries(schedule).filter(([, value]) => value !== null)),
    };
  }

  #changes(banner: BannerDto, imageFileId: string | null | undefined): UpdateBannerDto {
    const v = this.$value();
    const changes: Record<string, unknown> = {};
    if (v.type !== banner.type) changes['type'] = v.type;
    if (v.title.trim() !== banner.title) changes['title'] = v.title.trim();
    if ((v.subtitle.trim() || null) !== banner.subtitle) changes['subtitle'] = v.subtitle.trim() || null;
    if (v.display !== banner.display) changes['display'] = v.display;
    if (imageFileId !== undefined) changes['imageFileId'] = imageFileId;
    const link = this.#link();
    if (link.linkType !== banner.linkType || link.linkId !== banner.linkId || link.linkUrl !== banner.linkUrl) Object.assign(changes, link);
    if (this.#locationId() !== banner.locationId) changes['locationId'] = this.#locationId();
    if (this.$isActive() !== banner.isActive) changes['isActive'] = this.$isActive();
    if (!sameSchedule(this.$schedule(), this.#originalSchedule)) Object.assign(changes, scheduleToDto(this.$schedule(), this.data.timeZone));
    return changes as UpdateBannerDto;
  }
}

export function openBannerFormModal(dialog: MatDialog, data: BannerFormModalData): Observable<BannerDto | undefined> {
  return dialog
    .open<BannerFormModalComponent, BannerFormModalData, BannerDto>(BannerFormModalComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
