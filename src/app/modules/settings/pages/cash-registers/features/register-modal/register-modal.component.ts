import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CashRegisterDto, CashService, getCashErrorMessage } from 'src/app/modules/cash/data-access';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';

export const REGISTER_NAME_MAX = 100;

export type RegisterModalResult = 'created' | 'updated' | 'cancelled';

// Crear (con locales para elegir) o renombrar una caja existente.
export type RegisterModalData = Readonly<{
  register?: CashRegisterDto;
  locations: ReadonlyArray<Readonly<{ id: number; name: string }>>;
  locationId?: number | null;
}>;

@Component({
  selector: 'app-register-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  templateUrl: './register-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterModalComponent {
  readonly #dialogRef = inject<MatDialogRef<RegisterModalComponent, RegisterModalResult>>(MatDialogRef);
  readonly #cash = inject(CashService);
  readonly #toast = inject(ToastService);

  readonly data = inject<RegisterModalData>(MAT_DIALOG_DATA);
  readonly maxLength = REGISTER_NAME_MAX;
  readonly isEdit = !!this.data.register;

  readonly $name = signal(this.data.register?.name ?? '');
  readonly $locationId = signal<number | null>(
    this.data.register?.locationId ?? this.data.locationId ?? (this.data.locations.length === 1 ? this.data.locations[0].id : null),
  );
  readonly $touched = signal(false);
  readonly $isSaving = signal(false);

  readonly #trimmed = computed(() => this.$name().trim());
  readonly $nameInvalid = computed(() => !this.#trimmed() || this.#trimmed().length > REGISTER_NAME_MAX);
  readonly $locationInvalid = computed(() => !this.isEdit && !this.$locationId());

  onName(event: Event) {
    this.$name.set((event.target as HTMLInputElement).value);
  }

  onLocation(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.$locationId.set(value > 0 ? value : null);
  }

  submit() {
    if (this.$isSaving()) return;
    this.$touched.set(true);
    if (this.$locationInvalid()) {
      this.#toast.show('Elige el local de la caja', 'warning');
      return;
    }
    if (this.$nameInvalid()) {
      this.#toast.show(`Ingresa un nombre de hasta ${REGISTER_NAME_MAX} caracteres`, 'warning');
      return;
    }
    const register = this.data.register;
    if (register && register.name === this.#trimmed()) {
      this.#dialogRef.close('cancelled');
      return;
    }
    this.$isSaving.set(true);
    const request: Observable<unknown> = register
      ? this.#cash.updateRegister(register.id, { name: this.#trimmed() })
      : this.#cash.createRegister({ locationId: this.$locationId()!, name: this.#trimmed() });
    request.subscribe({
      next: () => this.#dialogRef.close(register ? 'updated' : 'created'),
      error: (error: unknown) => {
        this.$isSaving.set(false);
        this.#toast.show(getCashErrorMessage(error, register ? 'No se pudo renombrar la caja.' : 'No se pudo crear la caja.'), 'error');
      },
    });
  }

  cancel() {
    this.#dialogRef.close('cancelled');
  }
}
