import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, MenuModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = this.auth.email;
  readonly sidebarOpen = signal(true);

  readonly navItems = [
    { path: '/articles', label: '文章管理', icon: 'pi pi-file', exact: false },
    { path: '/dashboard', label: '數據分析', icon: 'pi pi-chart-bar', exact: false },
  ];

  readonly userMenu: MenuItem[] = [
    { label: '登出', icon: 'pi pi-sign-out', command: () => this.logout() },
  ];

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
