import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'blog-admin.auth';

interface AuthSession {
  email: string;
  loginAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Restore initial value from localStorage so a reload doesn't log the user out
  private readonly session = signal<AuthSession | null>(this.restore());

  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly email = computed(() => this.session()?.email ?? '');

  // Fake auth: a real app would call an API; this only needs to simulate it
  login(email: string, password: string): boolean {
    if (!email || password.length < 6) return false;

    const next: AuthSession = { email, loginAt: new Date().toISOString() };
    this.session.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  }

  logout(): void {
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private restore(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      return null;
    }
  }
}
