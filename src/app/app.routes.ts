import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

// loadComponent lazy-loads each feature page into its own chunk.
export const routes: Routes = [
  {
    path: 'login',
    title: '登入 · Blog Admin',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      {
        path: 'dashboard',
        title: '儀表板 · Blog Admin',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'articles',
        title: '文章管理 · Blog Admin',
        loadComponent: () =>
          import('./features/articles/article-list/article-list').then((m) => m.ArticleList),
      },
      {
        path: 'articles/new',
        title: '新增文章 · Blog Admin',
        loadComponent: () =>
          import('./features/articles/article-form/article-form').then((m) => m.ArticleForm),
      },
      {
        path: 'articles/:id/edit',
        title: '編輯文章 · Blog Admin',
        loadComponent: () =>
          import('./features/articles/article-form/article-form').then((m) => m.ArticleForm),
      },
      { path: '', pathMatch: 'full', redirectTo: 'articles' },
    ],
  },
  { path: '**', redirectTo: '' },
];
