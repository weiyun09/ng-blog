import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly FAKE_LATENCY = 500;

  readonly loginError = signal('');
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    // Validators.email is spec-permissive (allows dotless domains like a@b); the extra
    // pattern requires a dot in the domain so a@b won't pass.
    email: ['', [Validators.required, Validators.email, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    this.loginError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();

    // Simulate async login with a small delay to show the loading state
    setTimeout(() => {
      const ok = this.auth.login(email, password);
      this.submitting.set(false);

      if (!ok) {
        this.loginError.set('登入失敗，請確認 Email 與密碼（密碼至少 6 碼）。');
        return;
      }
      const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/articles';
      this.router.navigateByUrl(redirect);
    }, this.FAKE_LATENCY);
  }
}
