import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { MenuDynamicService, MenuSuggestionRuleDto, SaveMenuSuggestionRuleDto } from 'src/app/modules/public-menu/data-access';
import { dynamicInvalidField, dynamicSaveError, MenuDynamicCatalog, MenuDynamicItemsSelectComponent } from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService, ToggleComponent } from 'src/ui';

export type SuggestionRuleFormModalData = Readonly<{
  rule?: MenuSuggestionRuleDto;
  locationId: number;
  locationName: string;
  catalog: Signal<MenuDynamicCatalog | null>;
  catalogLoading: Signal<boolean>;
}>;

type Field = 'name' | 'triggers' | 'suggest' | 'message';

export const MAX_SUGGESTED = 6;
const NAME_MAX = 60;
const MESSAGE_MAX = 80;

const BACKEND_FIELDS: Readonly<Record<string, Field>> = {
  name: 'name',
  triggerProductIds: 'triggers',
  triggerCategoryIds: 'triggers',
  suggestProductIds: 'suggest',
  message: 'message',
};

/** Crear o editar una regla "Completa tu pedido". Devuelve la guardada (undefined = cancelado). */
@Component({
  selector: 'app-suggestion-rule-form-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective, ToggleComponent, MenuDynamicItemsSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suggestion-rule-form-modal.component.html',
})
export class SuggestionRuleFormModalComponent {
  readonly dialogRef = inject<MatDialogRef<SuggestionRuleFormModalComponent, MenuSuggestionRuleDto>>(MatDialogRef);
  readonly data = inject<SuggestionRuleFormModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(MenuDynamicService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly rule = this.data.rule ?? null;
  readonly nameMax = NAME_MAX;
  readonly messageMax = MESSAGE_MAX;
  readonly maxSuggested = MAX_SUGGESTED;

  readonly $name = signal(this.rule?.name ?? '');
  readonly $allLocations = signal(this.rule ? this.rule.locationId === null : false);
  readonly $triggerProductIds = signal<number[]>([...(this.rule?.triggerProductIds ?? [])]);
  readonly $triggerCategoryIds = signal<number[]>([...(this.rule?.triggerCategoryIds ?? [])]);
  readonly $suggestProductIds = signal<number[]>([...(this.rule?.suggestProductIds ?? [])]);
  readonly $message = signal(this.rule?.message ?? '');
  readonly $isActive = signal(this.rule?.isActive ?? true);

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $serverField = signal<Field | null>(null);
  readonly $problems = computed(() => this.#problems());

  show(field: Field): string | null {
    const message = this.$problems()[field] ?? null;
    if (!message) return null;
    return this.$submitted() || field === 'message' ? message : null;
  }

  setName(value: string) {
    this.$name.set(value);
    this.#clear('name');
  }

  setTriggers(kind: 'product' | 'category', ids: number[]) {
    (kind === 'product' ? this.$triggerProductIds : this.$triggerCategoryIds).set(ids);
    this.#clear('triggers');
  }

  setSuggested(ids: number[]) {
    this.$suggestProductIds.set(ids);
    this.#clear('suggest');
  }

  setMessage(value: string) {
    this.$message.set(value);
    this.#clear('message');
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
    let request: Observable<MenuSuggestionRuleDto>;
    if (this.rule) {
      const changes = this.#changes(this.rule, dto);
      if (!Object.keys(changes).length) {
        this.dialogRef.close();
        return;
      }
      request = this.#service.updateSuggestionRule(this.rule.id, changes);
    } else {
      request = this.#service.createSuggestionRule(dto);
    }
    this.$isSaving.set(true);
    request.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (saved) => {
        this.#toast.show(this.rule ? 'Regla actualizada' : 'Regla creada', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const field = dynamicInvalidField(error);
        if (field) this.$serverField.set(BACKEND_FIELDS[field] ?? null);
        const message = dynamicSaveError(error, 'No se pudo guardar la regla.', this.data.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  #clear(field: Field) {
    if (this.$serverField() === field) this.$serverField.set(null);
  }

  #problems(): Partial<Record<Field, string>> {
    const problems: Partial<Record<Field, string>> = {};
    const name = this.$name().trim();
    if (!name) problems.name = 'Escribe un nombre para la regla.';
    else if (name.length > NAME_MAX) problems.name = `Hasta ${NAME_MAX} caracteres.`;
    if (!this.$triggerProductIds().length && !this.$triggerCategoryIds().length) problems.triggers = 'Elige al menos un producto o una categoría.';
    const suggested = this.$suggestProductIds();
    if (!suggested.length) problems.suggest = 'Elige al menos un producto para sugerir.';
    else if (suggested.length > MAX_SUGGESTED) problems.suggest = `Hasta ${MAX_SUGGESTED} productos.`;
    if (this.$message().trim().length > MESSAGE_MAX) problems.message = `Hasta ${MESSAGE_MAX} caracteres.`;
    const server = this.$serverField();
    if (server && !problems[server]) problems[server] = 'El servidor rechazó este valor. Revísalo.';
    return problems;
  }

  #dto(): SaveMenuSuggestionRuleDto {
    return {
      locationId: this.$allLocations() ? null : this.data.locationId,
      name: this.$name().trim(),
      triggerProductIds: this.$triggerProductIds(),
      triggerCategoryIds: this.$triggerCategoryIds(),
      suggestProductIds: this.$suggestProductIds(),
      message: this.$message().trim() || null,
      isActive: this.$isActive(),
    };
  }

  /** Solo lo que cambió. */
  #changes(rule: MenuSuggestionRuleDto, dto: SaveMenuSuggestionRuleDto): SaveMenuSuggestionRuleDto {
    const changes: Record<string, unknown> = {};
    const same = (a: readonly number[] | undefined, b: readonly number[]) => (a ?? []).join() === b.join();
    if (dto.locationId !== rule.locationId) changes['locationId'] = dto.locationId;
    if (dto.name !== rule.name) changes['name'] = dto.name;
    if (!same(dto.triggerProductIds, rule.triggerProductIds)) changes['triggerProductIds'] = dto.triggerProductIds;
    if (!same(dto.triggerCategoryIds, rule.triggerCategoryIds)) changes['triggerCategoryIds'] = dto.triggerCategoryIds;
    if (!same(dto.suggestProductIds, rule.suggestProductIds)) changes['suggestProductIds'] = dto.suggestProductIds;
    if (dto.message !== rule.message) changes['message'] = dto.message;
    if (dto.isActive !== rule.isActive) changes['isActive'] = dto.isActive;
    return changes as SaveMenuSuggestionRuleDto;
  }
}

export function openSuggestionRuleFormModal(dialog: MatDialog, data: SuggestionRuleFormModalData): Observable<MenuSuggestionRuleDto | undefined> {
  return dialog
    .open<SuggestionRuleFormModalComponent, SuggestionRuleFormModalData, MenuSuggestionRuleDto>(SuggestionRuleFormModalComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
