import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';

// Single global <p-toast> container; pages push result notifications via MessageService
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule],
  template: '<p-toast /><router-outlet />',
})
export class App {}
