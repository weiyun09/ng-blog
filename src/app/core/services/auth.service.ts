import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'blog-admin.auth';

interface AuthSession {
  email: string;
  loginAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // 初始值從 localStorage 還原，讓重整後不會被登出
  private readonly session = signal<AuthSession | null>(this.restore());

  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly email = computed(() => this.session()?.email ?? '');

  // 假驗證：實務會打 API，作業只需模擬
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
