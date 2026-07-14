import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messageService = inject(MessageService);
  private readonly LIFE = 3000;

  success(summary: string, detail: string): void {
    this.messageService.add({ severity: 'success', summary, detail, life: this.LIFE });
  }

  error(summary: string, detail: string): void {
    this.messageService.add({ severity: 'error', summary, detail, life: this.LIFE });
  }
}
