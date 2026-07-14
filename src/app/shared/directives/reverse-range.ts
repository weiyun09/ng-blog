import { Directive, inject, OnInit, OnDestroy } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DatePicker } from 'primeng/datepicker';
import { sortDateRange } from '../utils/date-range';

@Directive({
  selector: 'p-datepicker[appReverseRange]',
  standalone: true,
})
export class ReverseRange implements OnInit, OnDestroy {
  private readonly picker = inject(DatePicker);
  private readonly ngControl = inject(NgControl, { optional: true });
  private readonly subs = new Subscription();

  private pendingStart: Date | null = null;

  ngOnInit(): void {
    this.subs.add(this.picker.onSelect.subscribe((date: Date) => this.handleSelect(date)));
    this.subs.add(this.picker.onClose.subscribe(() => (this.pendingStart = null)));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private handleSelect(date: Date): void {
    const value = this.ngControl?.control?.value as Date[] | null;

    if (value?.[0] && value?.[1]) {
      this.pendingStart = null;
      return;
    }

    if (this.pendingStart === null) {
      this.pendingStart = date;
      return;
    }

    const sorted = sortDateRange([this.pendingStart, date]);
    this.pendingStart = null;
    this.ngControl?.control?.setValue(sorted);
  }
}
