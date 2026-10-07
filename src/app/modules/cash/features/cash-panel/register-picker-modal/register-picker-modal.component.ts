import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective } from 'src/ui';
import { CashRegisterDto } from '../../../data-access';

export type RegisterPickerData = Readonly<{
  title: string;
  message?: string;
  registers: readonly CashRegisterDto[];
  selectedId?: number | null;
}>;

/** Elegir con qué caja trabaja el dispositivo. Devuelve el id de la caja o undefined. */
@Component({
  selector: 'app-register-picker-modal',
  standalone: true,
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './register-picker-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPickerModalComponent {
  private readonly dialogRef = inject<MatDialogRef<RegisterPickerModalComponent, number>>(MatDialogRef);
  readonly data = inject<RegisterPickerData>(MAT_DIALOG_DATA);
  readonly $selected = signal<number | null>(this.data.selectedId ?? this.data.registers[0]?.id ?? null);

  confirm() {
    const id = this.$selected();
    if (id !== null) this.dialogRef.close(id);
  }

  cancel() {
    this.dialogRef.close();
  }
}

export function openRegisterPicker(dialog: MatDialog, data: RegisterPickerData): Observable<number | undefined> {
  return dialog
    .open<RegisterPickerModalComponent, RegisterPickerData, number>(RegisterPickerModalComponent, {
      width: '440px',
      maxWidth: '95vw',
      data,
    })
    .afterClosed();
}
