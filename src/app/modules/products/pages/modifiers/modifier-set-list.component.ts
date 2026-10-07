import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  EmptyStateComponent,
  HeaderDashboardComponent,
  IconComponent,
  SkeletonComponent,
  ToastService,
} from 'src/ui';
import { getModifierSetErrorMessage, ModifierSetDto, ModifierSetsService } from './data-access';
import {
  ModifierSetModalComponent,
  ModifierSetModalData,
  ModifierSetModalResult,
  ModifierSetProductsModalComponent,
} from './features';
import { ModifierSetCardComponent } from './ui';

@Component({
  selector: 'app-modifier-set-list',
  imports: [HeaderDashboardComponent, ButtonComponent, IconComponent, EmptyStateComponent, SkeletonComponent, ModifierSetCardComponent],
  templateUrl: './modifier-set-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModifierSetListComponent implements OnInit {
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #service = inject(ModifierSetsService);

  readonly $sets = this.#service.$sets;
  readonly $isLoading = this.#service.$isLoading;
  // El error solo reemplaza la pantalla si no hay datos que mostrar.
  readonly $errorMessage = computed(() => {
    const error = this.#service.$error();
    return error && !this.#service.$sets() ? getModifierSetErrorMessage(error) : null;
  });
  readonly $isFirstLoad = computed(() => this.#service.$sets() === null && !this.#service.$error());
  readonly $isEmpty = computed(() => this.#service.$sets()?.length === 0);
  readonly $deletingId = signal<number | null>(null);

  ngOnInit(): void {
    this.#service.load();
  }

  handleRetry() {
    this.#service.load();
  }

  handleCreate() {
    this.#openForm({});
  }

  handleEdit(set: ModifierSetDto) {
    this.#openForm({ set });
  }

  handleProducts(set: ModifierSetDto) {
    this.#dialog
      .open<ModifierSetProductsModalComponent, ModifierSetDto, ModifierSetModalResult>(ModifierSetProductsModalComponent, {
        width: '600px',
        maxWidth: '95vw',
        disableClose: true,
        data: set,
      })
      .afterClosed()
      .subscribe((result) => this.#showResult(result));
  }

  handleDelete(set: ModifierSetDto) {
    const linked = set.modifierProducts.length;
    const linkedText = linked
      ? ` Dejará de ofrecerse en ${linked} ${linked === 1 ? 'producto' : 'productos'}.`
      : '';
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Eliminar set de modificadores',
          message: `¿Eliminar "${set.name}"?${linkedText}`,
          confirmText: 'Eliminar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.$deletingId.set(set.id);
        this.#service.delete(set.id).subscribe({
          next: () => {
            this.$deletingId.set(null);
            this.#toast.show('Set eliminado', 'success');
          },
          error: (error) => {
            this.$deletingId.set(null);
            this.#toast.show(getModifierSetErrorMessage(error, 'No se pudo eliminar el set.'), 'error');
          },
        });
      });
  }

  #openForm(data: ModifierSetModalData) {
    this.#dialog
      .open<ModifierSetModalComponent, ModifierSetModalData, ModifierSetModalResult>(ModifierSetModalComponent, {
        width: '640px',
        maxWidth: '95vw',
        disableClose: true,
        data,
      })
      .afterClosed()
      .subscribe((result) => this.#showResult(result));
  }

  #showResult(result: ModifierSetModalResult | undefined) {
    const messages: Record<ModifierSetModalResult, string> = {
      created: 'Set creado',
      updated: 'Set actualizado',
      linked: 'Productos actualizados',
    };
    if (result) this.#toast.show(messages[result], 'success');
  }
}
