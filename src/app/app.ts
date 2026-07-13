import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';

// 全域 <p-toast> 放這裡當唯一容器，各頁透過 MessageService 推播操作結果提示
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule],
  template: '<p-toast /><router-outlet />',
})
export class App {}
