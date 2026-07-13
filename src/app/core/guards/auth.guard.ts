import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// function guard（CanActivateFn），透過 inject() 取得依賴。
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  // 帶上原網址，登入後可導回
  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};
