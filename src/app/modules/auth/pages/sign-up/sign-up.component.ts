import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { AlertComponent, ButtonComponent, IconComponent } from 'src/ui';
import { SignUpTermsAndConditionsComponent } from 'src/ui/organisms/terms-and-conditions/sign-up';
import { formatRut, rutValidator } from 'src/app/shared/validators';
import { emailFormatValidator, getPasswordStrength, passwordMatchValidator } from '../custom-validators';
import { LegalApiService, legalDocumentsOf, LegalErrorCode, PendingDocumentDto, requiredAccepted } from 'src/app/core/services/legal';
import { readApiError } from 'src/app/core/utils/api-error';
import { LegalDocumentChecklistComponent } from 'src/app/modules/legal/ui';
import { AuthError, AuthService, getAuthError, GoogleSignInService, PostLoginService } from '../data-access';
import { GoogleButtonComponent } from '../ui';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    IconComponent,
    AlertComponent,
    SignUpTermsAndConditionsComponent,
    GoogleButtonComponent,
    LegalDocumentChecklistComponent,
  ],
})
export class SignUpComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly postLogin = inject(PostLoginService);
  private readonly googleSignIn = inject(GoogleSignInService);
  private readonly legalApi = inject(LegalApiService);

  // Términos de uso y privacidad vigentes (null mientras cargan; vacío si aún no hay versiones publicadas).
  readonly $legalDocuments = signal<readonly PendingDocumentDto[] | null>(null);
  readonly $acceptedVersions = signal<readonly number[]>([]);

  hide = true;
  hideConfirm = true;
  submitted = false;
  passwordStrength = 0;
  readonly $isSaving = signal(false);
  readonly $googleLoading = signal(false);
  readonly $error = signal<AuthError | null>(null);

  private fb = inject(FormBuilder);

  form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(100)]],
      fatherLastName: ['', [Validators.required, Validators.maxLength(100)]],
      motherLastName: ['', [Validators.maxLength(100)]],
      rut: ['', [rutValidator]],
      email: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', [Validators.required]],
      // Solo cuenta si no hay documentos publicados (texto de referencia anterior).
      acceptTerms: [false],
    },
    {
      validators: [passwordMatchValidator('password', 'confirmPassword'), emailFormatValidator('email')],
    },
  );

  // Primer problema del formulario, en palabras simples.
  $validationMessage() {
    const controls = this.form.controls;
    if (controls.name.invalid || controls.fatherLastName.invalid) return 'Ingresa tu nombre y apellido paterno.';
    if (controls.rut.invalid) return 'El RUT no es válido.';
    if (controls.email.invalid || this.form.hasError('emailNotValid')) return 'El email debe ser válido.';
    if (controls.password.invalid) return 'La contraseña debe tener entre 8 y 72 caracteres.';
    if (this.form.hasError('controlNotMatch')) return 'Las contraseñas deben ser iguales.';
    if (!this.#legalAccepted()) return 'Debes aceptar los términos y condiciones.';
    return null;
  }

  constructor() {
    this.loadLegalDocuments();
  }

  loadLegalDocuments() {
    this.legalApi.currentDocuments(['platformTerms', 'privacyPolicy']).subscribe((documents) => this.#showLegal(documents));
  }

  #legalAccepted(): boolean {
    const documents = this.$legalDocuments() ?? [];
    return documents.length ? requiredAccepted(documents, this.$acceptedVersions()) : this.form.controls.acceptTerms.value;
  }

  #showLegal(documents: readonly PendingDocumentDto[]) {
    this.$legalDocuments.set(documents);
    this.$acceptedVersions.set([]);
  }

  formatRut() {
    const control = this.form.controls.rut;
    if (control.value && control.valid) control.setValue(formatRut(control.value));
  }

  submitForm() {
    this.submitted = true;
    this.$error.set(null);
    if (this.form.invalid || !this.#legalAccepted()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const email = value.email.trim().toLowerCase();
    this.$isSaving.set(true);
    this.authService
      .register({
        name: value.name.trim(),
        fatherLastName: value.fatherLastName.trim(),
        motherLastName: value.motherLastName.trim() || undefined,
        email,
        password: value.password,
        rut: value.rut.trim() || undefined,
        ...(this.$legalDocuments()?.length ? { acceptedVersionIds: [...this.$acceptedVersions()] } : {}),
      })
      .subscribe({
        // Si ya estaba registrado sin verificar, el backend responde 201 y reenvía el código.
        next: () => {
          this.$isSaving.set(false);
          this.router.navigate(['/auth/verify-email'], { queryParams: { email } });
        },
        error: (error) => {
          this.$isSaving.set(false);
          this.$error.set(getAuthError(error));
          // Faltan documentos o cambió una versión: se vuelven a mostrar para aceptarlos de nuevo.
          const documents = legalDocumentsOf(error);
          if (documents) this.#showLegal(documents);
          else if (readApiError(error).code === LegalErrorCode.VERSION_NOT_PUBLISHED) this.loadLegalDocuments();
        },
      });
  }

  // Google registra e inicia sesión con el mismo botón (sin verificación de email).
  signUpWithGoogle(idToken: string) {
    this.$error.set(null);
    this.$googleLoading.set(true);
    this.googleSignIn.signIn(idToken).subscribe({
      next: (session) => {
        this.$googleLoading.set(false);
        this.postLogin.continue(session.userData.name, session.isNewUser);
      },
      complete: () => this.$googleLoading.set(false),
      error: (error) => {
        this.$googleLoading.set(false);
        this.$error.set(getAuthError(error));
      },
    });
  }

  updatePasswordStrength(event: Event) {
    const input = event.target as HTMLInputElement;
    this.passwordStrength = getPasswordStrength(input.value);
  }
}
