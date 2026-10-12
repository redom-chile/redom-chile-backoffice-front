import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent, IconComponent, ToastService } from 'src/ui';
import { CreateBusinessLocationDto } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { LocationDraft } from '../../../../data-access';

/**
 * Paso "Tu local": obligatorio, sin local no se pueden tomar pedidos.
 * Solo arma el local; el padre lo guarda (junto con el negocio, o solo el local si el negocio ya existía).
 */
@Component({
  selector: 'app-step-location',
  templateUrl: './step-location.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent],
})
export class StepLocationComponent {
  readonly #toast = inject(ToastService);

  readonly businessName = input('');
  readonly draft = input<LocationDraft | null>(null);
  readonly saving = input(false);
  // El negocio aún no existe: el botón lo crea junto con el local.
  readonly createsBusiness = input(false);
  readonly submitted = output<CreateBusinessLocationDto>();
  readonly draftChange = output<LocationDraft>();

  submittedOnce = false;

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(256)]],
    address: [''],
    city: ['', [Validators.maxLength(100)]],
    mobile: ['', [Validators.maxLength(30)]],
  });

  constructor() {
    // Se retoma lo escrito antes de volver a "Tu negocio" (solo al entrar al paso).
    let restored = false;
    effect(() => {
      const draft = this.draft();
      untracked(() => {
        if (restored) return;
        restored = true;
        if (!draft) return;
        const { nameEdited, ...values } = draft;
        this.form.setValue(values, { emitEvent: false });
        if (nameEdited) this.form.controls.name.markAsDirty();
      });
    });

    // Nombre del local = nombre del negocio, mientras el usuario no lo cambie.
    effect(() => {
      const name = this.businessName();
      untracked(() => {
        if (name && !this.form.controls.name.dirty) this.form.controls.name.setValue(name.slice(0, 256));
      });
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.draftChange.emit({ ...this.form.getRawValue(), nameEdited: this.form.controls.name.dirty });
    });
  }

  submit() {
    if (this.saving()) return;
    this.submittedOnce = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Ponle un nombre a tu local', 'warning');
      return;
    }
    const { name, address, city, mobile } = this.form.getRawValue();
    this.submitted.emit({
      name: name.trim(),
      country: 'Chile',
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(mobile.trim() ? { mobile: mobile.trim() } : {}),
    });
  }
}
