import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  // Pass the original URL so we can redirect back after login
  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};
