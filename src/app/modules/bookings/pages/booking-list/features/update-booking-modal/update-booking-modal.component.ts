import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { GetAllTablesService } from 'src/app/modules/tables/pages/table-list/data-access';
import { BookingService, getBookingErrorMessage } from '../../data-access';
import { BookingFormFieldsComponent, createBookingForm, createdByLabel, isMenuBooking, isPendingMenuBooking, toUpdateBookingDto } from '../../ui';
import { BookingModalResult, UpdateBookingModalData } from '../booking-modal-result';

@Component({
  selector: 'app-update-booking-modal',
  standalone: true,
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, BookingFormFieldsComponent],
  templateUrl: './update-booking-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateBookingModalComponent {
  private readonly dialogRef = inject<MatDialogRef<UpdateBookingModalComponent, BookingModalResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly bookingService = inject(BookingService);
  private readonly tablesService = inject(GetAllTablesService);

  private readonly data = inject<UpdateBookingModalData>(MAT_DIALOG_DATA);
  readonly booking = this.data.booking;
  readonly focusTable = this.data.focus === 'table';
  readonly form = createBookingForm(inject(FormBuilder), { date: '', booking: this.booking });
  readonly $tables = this.tablesService.$tables;
  readonly $isSaving = signal(false);
  readonly fromMenu = isMenuBooking(this.booking);
  readonly pendingFromMenu = isPendingMenuBooking(this.booking);
  readonly author = createdByLabel(this.booking);

  constructor() {
    this.tablesService.setParams(this.booking.locationId);
  }

  handleSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.show('Completa la fecha, la hora y las personas', 'warning');
      return;
    }
    const changes = toUpdateBookingDto(this.form, this.booking);
    if (Object.keys(changes).length === 1) {
      this.dialogRef.close();
      return;
    }
    this.$isSaving.set(true);
    this.bookingService.update(changes).subscribe({
      next: () => this.dialogRef.close('updated'),
      error: (error: HttpErrorResponse) => {
        this.$isSaving.set(false);
        this.toast.show(getBookingErrorMessage(error), 'error');
      },
    });
  }

  handleCancel() {
    this.dialogRef.close();
  }
}
