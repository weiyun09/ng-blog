import { Directive, inject, OnInit, OnDestroy } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DatePicker } from 'primeng/datepicker';
import { sortDateRange } from '../utils/date-range';

/**
 * 讓 PrimeNG datepicker（range 模式）支援「反向點選」。
 *
 * 原生行為（datepicker 原始碼）：第二次點選較早的日期時會重置選取成 [新日期, null]，
 * 導致使用者無法形成反向區間。本 directive 攔截 onSelect，自行記住第一個起點，
 * 第二次點選時把兩個日期正規化成 [早, 晚] 寫回表單控制項。
 *
 * 用法：<p-datepicker formControlName="..." selectionMode="range" appReverseRange />
 */
@Directive({
  selector: 'p-datepicker[appReverseRange]',
  standalone: true,
})
export class ReverseRange implements OnInit, OnDestroy {
  private readonly picker = inject(DatePicker);
  private readonly ngControl = inject(NgControl, { optional: true });
  private readonly subs = new Subscription();

  // 尚未完成配對的第一個起點；null 代表下一次點選視為新區間的起點
  private pendingStart: Date | null = null;

  ngOnInit(): void {
    this.subs.add(this.picker.onSelect.subscribe((date: Date) => this.handleSelect(date)));
    // 關閉面板時清掉未完成的起點，避免下次點選被誤判為第二次
    this.subs.add(this.picker.onClose.subscribe(() => (this.pendingStart = null)));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private handleSelect(date: Date): void {
    // 此時 PrimeNG 已更新表單值：完成區間時為 [start, end] 兩者皆有
    const value = this.ngControl?.control?.value as Date[] | null;

    if (value?.[0] && value?.[1]) {
      // 正向完成，PrimeNG 已排好序，只需清狀態
      this.pendingStart = null;
      return;
    }

    // 只有一個日期 → 第一次點選，或反向的第二次點選
    if (this.pendingStart === null) {
      this.pendingStart = date;
      return;
    }

    // 第二次點選：正規化成 [早, 晚] 寫回控制項
    const sorted = sortDateRange([this.pendingStart, date]);
    this.pendingStart = null;
    this.ngControl?.control?.setValue(sorted);
  }
}
