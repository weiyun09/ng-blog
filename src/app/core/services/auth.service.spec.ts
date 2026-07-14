import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'blog-admin.auth';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    // Clear localStorage before each test so leftover state doesn't affect restore()
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('合法 email + 密碼 ≥ 6 碼 → 登入成功', () => {
    const ok = service.login('hina@example.com', '123456');

    expect(ok).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.email()).toBe('hina@example.com');
  });

  it('密碼剛好 6 碼（邊界）→ 通過', () => {
    expect(service.login('hina@example.com', '123456')).toBe(true);
  });

  it('密碼只有 5 碼 → 登入失敗且維持未登入', () => {
    const ok = service.login('hina@example.com', '12345');

    expect(ok).toBe(false);
    expect(service.isLoggedIn()).toBe(false);
  });

  it('email 為空字串 → 登入失敗', () => {
    expect(service.login('', '123456')).toBe(false);
    expect(service.isLoggedIn()).toBe(false);
  });

  it('登入成功後會把 session 寫進 localStorage', () => {
    service.login('hina@example.com', '123456');

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).email).toBe('hina@example.com');
  });

  it('logout() 會清空 session 與 localStorage', () => {
    service.login('hina@example.com', '123456');
    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
