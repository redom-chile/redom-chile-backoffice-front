import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, switchMap } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { moveInList } from 'src/app/modules/products/shared';
import { getPublicMenuErrorMessage, MenuDynamicService, MenuSuggestionRuleDto } from 'src/app/modules/public-menu/data-access';
import { isAlreadyDeleted } from 'src/app/modules/public-menu/features/marketing-shared';
import {
  categoryName,
  dynamicSaveError,
  isDynamicStageMissing,
  MenuDynamicCatalog,
  MenuDynamicMoveButtonsComponent,
  MenuDynamicStageBannerComponent,
  namesSummary,
  productName,
} from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, EmptyStateComponent, IconComponent, SkeletonComponent, ToastService, ToggleComponent } from 'src/ui';
import { openSuggestionRuleFormModal } from './suggestion-rule-form-modal.component';
import { SuggestionSettingsCardComponent } from './suggestion-settings-card.component';

/** Pestaña Sugerencias: reglas "Completa tu pedido" (en orden de prioridad) y cómo se arman. */
@Component({
  selector: 'app-menu-dynamic-suggestions',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ToggleComponent,
    CheckPermissionDirective,
    MenuDynamicMoveButtonsComponent,
    MenuDynamicStageBannerComponent,
    SuggestionSettingsCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-dynamic-suggestions.component.html',
})
export class MenuDynamicSuggestionsComponent {
  readonly #service = inject(MenuDynamicService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);

  readonly locationId = input.required<number>();
  readonly locationName = input('');
  readonly hasPlus = input(false);
  readonly catalog = input<MenuDynamicCatalog | null>(null);
  readonly catalogLoading = input(false);

  readonly PERMISSIONS = PERMISSIONS;
  readonly handleClass = 'text-muted-foreground inline-flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing';
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));

  readonly rules = rxResource({
    params: () => this.locationId(),
    stream: ({ params }) => this.#service.getSuggestionRules(params).pipe(toRemoteResult()),
  });
  readonly $list = linkedSignal(() => [...(resultValue(this.rules.value()) ?? [])].sort((a, b) => a.position - b.position));
  readonly $error = computed(() => resultError(this.rules.value()));
  readonly $missing = computed(() => isDynamicStageMissing(this.$error()));
  readonly $errorMessage = computed(() => getPublicMenuErrorMessage(this.$error(), 'No se pudieron cargar las reglas.'));
  readonly $loaded = computed(() => !!resultValue(this.rules.value()));
  readonly $locked = computed(() => !this.$canManage() || this.$missing());
  readonly $busyId = signal<number | null>(null);
  readonly $reordering = signal(false);
  private readonly settingsCard = viewChild(SuggestionSettingsCardComponent);

  /** Configuración de sugerencias sin guardar. */
  hasUnsavedChanges(): boolean {
    return this.settingsCard()?.$dirty() ?? false;
  }

  triggers(rule: MenuSuggestionRuleDto): string {
    const catalog = this.catalog();
    return namesSummary([...rule.triggerProductIds.map((id) => productName(catalog, id)), ...rule.triggerCategoryIds.map((id) => categoryName(catalog, id))]);
  }

  suggested(rule: MenuSuggestionRuleDto): string {
    return namesSummary(
      rule.suggestProductIds.map((id) => productName(this.catalog(), id)),
      3,
    );
  }

  create() {
    this.#open();
  }

  edit(rule: MenuSuggestionRuleDto) {
    this.#open(rule);
  }

  toggle(rule: MenuSuggestionRuleDto, isActive: boolean) {
    if (this.$busyId() !== null || this.$locked()) return;
    this.$busyId.set(rule.id);
    this.#replace({ ...rule, isActive });
    this.#service.updateSuggestionRule(rule.id, { isActive }).subscribe({
      next: (saved) => {
        this.$busyId.set(null);
        this.#replace(saved);
        this.#toast.show(isActive ? 'Regla activada' : 'Regla desactivada', 'success');
      },
      error: (error: unknown) => {
        this.$busyId.set(null);
        this.#replace(rule);
        const message = dynamicSaveError(error, 'No se pudo cambiar la regla.', this.catalog());
        if (message) this.#toast.show(message, 'error');
      },
    });
  }

  remove(rule: MenuSuggestionRuleDto) {
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar regla',
          message: `¿Eliminar "${rule.name}"? Deja de sugerir esos productos.`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(rule.id);
          return this.#service.deleteSuggestionRule(rule.id);
        }),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.$list.update((list) => list.filter((item) => item.id !== rule.id));
          this.#toast.show('Regla eliminada', 'success');
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          if (isAlreadyDeleted(error) && !isDynamicStageMissing(error)) {
            this.$list.update((list) => list.filter((item) => item.id !== rule.id));
            this.#toast.show('Esa regla ya no existía. Actualizamos la lista.', 'success');
            return;
          }
          const message = dynamicSaveError(error, 'No se pudo eliminar la regla.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  drop(event: CdkDragDrop<unknown>) {
    this.#reorder(moveInList(this.$list(), event.previousIndex, event.currentIndex));
  }

  move(index: number, delta: number) {
    this.#reorder(moveInList(this.$list(), index, index + delta));
  }

  #reorder(next: MenuSuggestionRuleDto[]) {
    const previous = this.$list();
    if (this.$reordering() || this.$locked() || next.map((item) => item.id).join() === previous.map((item) => item.id).join()) return;
    this.$list.set(next);
    this.$reordering.set(true);
    this.#service
      .reorderSuggestionRules(
        this.locationId(),
        next.map((item) => item.id),
      )
      .subscribe({
        next: (ordered) => {
          this.$reordering.set(false);
          if (Array.isArray(ordered) && ordered.length) this.$list.set(ordered);
          this.#toast.show('Orden guardado', 'success');
        },
        error: (error: unknown) => {
          this.$reordering.set(false);
          this.$list.set(previous);
          const message = dynamicSaveError(error, 'No se pudo guardar el orden.');
          if (message) this.#toast.show(message, 'error');
        },
      });
  }

  #open(rule?: MenuSuggestionRuleDto) {
    if (this.$locked()) return;
    openSuggestionRuleFormModal(this.#dialog, {
      rule,
      locationId: this.locationId(),
      locationName: this.locationName(),
      catalog: this.catalog,
      catalogLoading: this.catalogLoading,
    })
      .pipe(filter((saved) => !!saved))
      .subscribe(() => this.rules.reload());
  }

  #replace(rule: MenuSuggestionRuleDto) {
    this.$list.update((list) => list.map((item) => (item.id === rule.id ? rule : item)));
  }
}
