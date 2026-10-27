import { NgClass } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { AlertComponent, ButtonComponent, IconComponent, ToastService } from 'src/ui';
import { emailFormatValidator } from '../custom-validators';
import { AuthError, AuthService, getAuthError, GoogleSignInService, PostLoginService } from '../data-access';
import { GoogleButtonComponent } from '../ui';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    AngularSvgIconModule,
    ButtonComponent,
    NgClass,
    IconComponent,
    AlertComponent,
    GoogleButtonComponent,
  ],
})
export class SignInComponent {
  readonly #httpService = inject(AuthService);
  hide = true;
  submitted = false;
  passwordTextType!: boolean;
  errorMessage: string = '';
  readonly $isLoading = this.#httpService.$isLoading;

  constructor(private readonly _router: Router, private readonly toast: ToastService) {}

  private fb = inject(FormBuilder);

  loginForm = this.fb.group(
    {
      email: ['', [Validators.required]],
      password: ['', [Validators.required]],
    },
    {
      validators: [emailFormatValidator('email')],
    },
  );

  get f() {
    return this.loginForm.controls;
  }

  togglePasswordTextType() {
    this.passwordTextType = !this.passwordTextType;
  }

  readonly #postLogin = inject(PostLoginService);
  readonly #googleSignIn = inject(GoogleSignInService);
  readonly $error = signal<AuthError | null>(null);
  readonly $googleLoading = signal(false);

  loginUser() {
    this.submitted = true;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const email = this.loginForm.get('email')!.value!.trim().toLowerCase();
    const password = this.loginForm.get('password')!.value!;
    this.$error.set(null);

    this.#httpService.login({ email, password }).subscribe({
      next: (session) => this.#postLogin.continue(session.userData.name),
      error: (error) => {
        const authError = getAuthError(error);
        // Email sin verificar: se reenvía el código y se lleva a "Verifica tu correo".
        if (authError.kind === 'email-not-verified') {
          this.#httpService.resendVerificationEmail(email).subscribe({ error: () => undefined });
          this.toast.show(authError.message, 'warning');
          this._router.navigate(['/auth/verify-email'], { queryParams: { email } });
          return;
        }
        this.$error.set(authError);
      },
    });
  }

  loginWithGoogle(idToken: string) {
    this.$error.set(null);
    this.$googleLoading.set(true);
    this.#googleSignIn.signIn(idToken).subscribe({
      next: (session) => {
        this.$googleLoading.set(false);
        this.#postLogin.continue(session.userData.name, session.isNewUser);
      },
      // Canceló la aceptación de los documentos de una cuenta nueva.
      complete: () => this.$googleLoading.set(false),
      error: (error) => {
        this.$googleLoading.set(false);
        this.$error.set(getAuthError(error));
      },
    });
  }

  // protected readonly $hasError = toSignal(this.#httpService.hasError$);
}
