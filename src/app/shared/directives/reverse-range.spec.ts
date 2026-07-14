import { EventEmitter } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, NgControl } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { ReverseRange } from './reverse-range';

/**
 * Mocks PrimeNG DatePicker: keeps only the onSelect / onClose this directive uses.
 * Real sequence is "update form value -> then emit onSelect"; reproduced here by setValue then emit.
 */
class MockDatePicker {
  onSelect = new EventEmitter<Date>();
  onClose = new EventEmitter<void>();
}

describe('ReverseRange directive', () => {
  let picker: MockDatePicker;
  let control: FormControl<Date[] | null>;

  const early = new Date(2026, 6, 1); // 7/1 (month is 0-based)
  const mid = new Date(2026, 6, 3); // 7/3
  const late = new Date(2026, 6, 5); // 7/5

  // Simulate one click: apply PrimeNG's updated value, then emit onSelect
  const click = (primengValue: Date[], clicked: Date) => {
    control.setValue(primengValue);
    picker.onSelect.emit(clicked);
  };

  beforeEach(() => {
    picker = new MockDatePicker();
    control = new FormControl<Date[] | null>(null);

    TestBed.configureTestingModule({
      providers: [
        ReverseRange,
        { provide: DatePicker, useValue: picker },
        { provide: NgControl, useValue: { control } as unknown as NgControl },
      ],
    });
    TestBed.inject(ReverseRange).ngOnInit();
  });

  it('反向點選（先 7/3 後 7/1）會正規化成 [7/1, 7/3]', () => {
    click([mid, null as unknown as Date], mid); // PrimeNG sets [7/3, null]
    click([early, null as unknown as Date], early); // PrimeNG resets backwards to [7/1, null]

    expect(control.value).toEqual([early, mid]);
  });

  it('正向點選（先 7/1 後 7/3）維持 [7/1, 7/3]', () => {
    click([early, null as unknown as Date], early);
    click([early, mid], mid); // PrimeNG completes normally

    expect(control.value).toEqual([early, mid]);
  });

  it('完成一段區間後可再開新區間，反向仍正規化', () => {
    click([early, null as unknown as Date], early);
    click([early, late], late); // complete [7/1, 7/5]
    click([mid, null as unknown as Date], mid); // start a new range: click 7/3 first
    click([early, null as unknown as Date], early); // click 7/1 backwards

    expect(control.value).toEqual([early, mid]);
  });

  it('關閉面板會清掉未完成的起點，下次點選視為新起點', () => {
    click([mid, null as unknown as Date], mid); // clicked 7/3 but not a second date
    picker.onClose.emit();
    click([late, null as unknown as Date], late); // click 7/5 again: should be a new start, not paired with 7/3

    expect(control.value).toEqual([late, null]);
  });
});
