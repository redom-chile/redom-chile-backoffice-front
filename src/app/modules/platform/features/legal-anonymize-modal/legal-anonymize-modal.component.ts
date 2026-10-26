import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getLegalErrorMessage, PlatformLegalService } from '../../data-access';

/** Anonimiza los registros de un correo (derecho del titular). Devuelve cuántos registros cambió. */
@Component({
  selector: 'app-legal-anonymize-modal',
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Anonimizar por correo</h2>
      </ng-template>

      @if ($records() === null) {
        <form class="space-y-4 p-2 text-sm" [formGroup]="form" (ngSubmit)="handleSubmit()">
          <p class="text-muted-foreground">
            Reemplaza el correo, la IP y el navegador por su huella (sha256) en todos los registros de esa persona. Los registros se mantienen como
            prueba, pero ya no se podrán buscar por su correo. <strong class="text-foreground">No se puede deshacer.</strong>
          </p>
          <div>
            <label for="legal-anon-email" class="mb-1 block font-medium">Correo *</label>
            <input
              id="legal-anon-email"
              type="email"
              autocomplete="off"
              formControlName="email"
              placeholder="persona@correo.cl"
              class="glass-input w-full rounded-md px-3 py-2"
              [class.border-red-500]="form.controls.email.invalid && form.controls.email.touched" />
          </div>
          <div>
            <label for="legal-anon-reason" class="mb-1 block font-medium">Motivo</label>
            <textarea
              id="legal-anon-reason"
              rows="2"
              maxlength="300"
              formControlName="reason"
              placeholder="Ej: Solicitud del titular por correo"
              class="glass-input w-full resize-y rounded-md px-3 py-2"></textarea>
          </div>
          <label class="flex items-start gap-2">
            <input type="checkbox" formControlName="confirmed" class="mt-0.5" />
            <span class="text-foreground">Entiendo que es irreversible.</span>
          </label>
          <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
        </form>
      } @else {
        <div class="space-y-2 p-2 text-center text-sm">
          <p class="text-foreground text-3xl font-semibold tabular-nums">{{ $records() }}</p>
          <p class="text-muted-foreground">{{ $records() === 1 ? 'registro anonimizado' : 'registros anonimizados' }}.</p>
          @if ($records() === 0) {
            <p class="text-muted-foreground text-xs">No había registros con ese correo (o ya estaban anonimizados).</p>
          }
        </div>
      }

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          @if ($records() === null) {
            <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
            <app-button type="button" impact="bold" tone="danger" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">Anonimizar</app-button>
          } @else {
            <app-button type="button" impact="bold" (buttonClick)="dialogRef.close($records()!)">Cerrar</app-button>
          }
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class LegalAnonymizeModalComponent {
  readonly dialogRef = inject<MatDialogRef<LegalAnonymizeModalComponent, number>>(MatDialogRef);
  readonly #fb = inject(FormBuilder);
  readonly #legal = inject(PlatformLegalService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly form = this.#fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    reason: ['', Validators.maxLength(300)],
    confirmed: [false, Validators.requiredTrue],
  });
  readonly $isSaving = signal(false);
  readonly $records = signal<number | null>(null);

  handleSubmit() {
    if (this.$isSaving()) return;
    this.form.patchValue({ email: this.form.controls.email.value.trim().toLowerCase() });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show(this.form.controls.email.invalid ? 'Ingresa un correo válido' : 'Confirma que entiendes que es irreversible', 'warning');
      return;
    }
    const { email, reason } = this.form.getRawValue();
    this.$isSaving.set(true);
    this.#legal
      .anonymize(email, reason.trim() || null)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: ({ records }) => {
          this.$isSaving.set(false);
          this.$records.set(records);
          this.#toast.show(`Anonimización lista: ${records} ${records === 1 ? 'registro' : 'registros'}`, 'success');
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getLegalErrorMessage(error, 'No se pudo anonimizar'), 'error');
        },
      });
  }
}

export function openLegalAnonymizeModal(dialog: MatDialog): Observable<number | undefined> {
  return dialog
    .open<LegalAnonymizeModalComponent, void, number>(LegalAnonymizeModalComponent, { width: '480px', maxWidth: '95vw', disableClose: true })
    .afterClosed();
}
