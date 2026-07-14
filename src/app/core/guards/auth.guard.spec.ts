import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  UrlTree,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  // Run the guard with a given login state and target URL
  const runGuard = (isLoggedIn: boolean, url = '/articles') => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: () => isLoggedIn } },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      authGuard(
        {} as unknown as ActivatedRouteSnapshot,
        { url } as unknown as RouterStateSnapshot,
      ),
    );
  };

  it('已登入 → 放行（true）', () => {
    expect(runGuard(true)).toBe(true);
  });

  it('未登入 → 回傳導向 /login 的 UrlTree，並帶原網址作為 redirect', () => {
    const result = runGuard(false, '/articles');
    expect(result).toBeInstanceOf(UrlTree);
    const tree = result as UrlTree;
    expect(tree.toString()).toContain('/login');
    expect(tree.queryParams['redirect']).toBe('/articles');
  });
});
