import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';

import { AuthService } from '../../../core/services/auth.service';
import { WatchProgressService } from '../../../core/services/watch-progress.service';

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  if (!confirmPassword) {
    return null;
  }
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    FloatLabelModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly progress = inject(WatchProgressService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);
  readonly registrationEnabled = signal(true);

  readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      username: [''],
      displayName: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: [''],
    },
    { validators: passwordsMatch },
  );

  ngOnInit(): void {
    void this.loadAuthConfig();
  }

  setMode(mode: 'login' | 'register'): void {
    if (mode === 'register' && !this.registrationEnabled()) {
      return;
    }

    this.mode.set(mode);

    const username = this.form.controls.username;
    const displayName = this.form.controls.displayName;
    const confirmPassword = this.form.controls.confirmPassword;

    if (mode === 'register') {
      username.setValidators([
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(64),
        Validators.pattern(USERNAME_PATTERN),
      ]);
      displayName.setValidators([Validators.required, Validators.maxLength(128)]);
      confirmPassword.setValidators([Validators.required]);
    } else {
      username.clearValidators();
      displayName.clearValidators();
      confirmPassword.clearValidators();
    }

    username.updateValueAndValidity();
    displayName.updateValueAndValidity();
    confirmPassword.updateValueAndValidity();
    this.form.updateValueAndValidity();
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { email, password, username, displayName } = this.form.getRawValue();

    try {
      if (this.mode() === 'register') {
        if (!this.registrationEnabled()) {
          throw new Error('Registration is disabled');
        }

        await this.auth.register({
          email,
          username: username || email.split('@')[0],
          password,
          displayName: displayName || username || email.split('@')[0],
        });
        this.messages.add({
          severity: 'success',
          summary: 'Account created',
          detail: 'Welcome to the Arrowverse timeline. Signing you in…',
          life: 3500,
        });
      }

      await this.auth.login(email, password);
      await this.progress.reload();
      await this.router.navigate(['/watch-order']);
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'Authentication failed',
        detail: this.extractErrorMessage(error) ?? 'Check your credentials and try again.',
        life: 6000,
      });
    } finally {
      this.loading.set(false);
    }
  }

  private extractErrorMessage(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    const detail = error.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item: { loc?: string[]; msg?: string }) => {
          const field = item.loc?.at(-1) ?? 'field';
          return `${field}: ${item.msg ?? 'invalid value'}`;
        })
        .join(' · ');
    }

    return null;
  }

  private async loadAuthConfig(): Promise<void> {
    try {
      const config = await this.auth.getAuthConfig();
      this.registrationEnabled.set(config.public_registration);
      if (!config.public_registration && this.mode() === 'register') {
        this.setMode('login');
      }
    } catch {
      this.registrationEnabled.set(true);
    }
  }
}
