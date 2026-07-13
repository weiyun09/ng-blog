import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input('確認');
  readonly message = input('確定要執行此操作嗎？');
  readonly confirmText = input('確定');
  readonly cancelText = input('取消');

  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
