import { EventEmitter } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, NgControl } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { ReverseRange } from './reverse-range';

/**
 * 模擬 PrimeNG DatePicker：只保留本 directive 會用到的 onSelect / onClose。
 * 真實時序為「先更新表單值 → 再 emit onSelect」，測試中以 setValue 後 emit 還原。
 */
class MockDatePicker {
  onSelect = new EventEmitter<Date>();
  onClose = new EventEmitter<void>();
}

describe('ReverseRange directive', () => {
  let picker: MockDatePicker;
  let control: FormControl<Date[] | null>;

  const d1 = new Date(2026, 6, 1); // 7/1
  const d3 = new Date(2026, 6, 3); // 7/3
  const d5 = new Date(2026, 6, 5); // 7/5

  // 模擬一次點選：先套用 PrimeNG 更新後的 value，再發 onSelect
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
    click([d3, null as unknown as Date], d3); // PrimeNG 設 [7/3, null]
    click([d1, null as unknown as Date], d1); // PrimeNG 反向重置成 [7/1, null]

    expect(control.value).toEqual([d1, d3]);
  });

  it('正向點選（先 7/1 後 7/3）維持 [7/1, 7/3]', () => {
    click([d1, null as unknown as Date], d1);
    click([d1, d3], d3); // PrimeNG 正常完成

    expect(control.value).toEqual([d1, d3]);
  });

  it('完成一段區間後可再開新區間，反向仍正規化', () => {
    click([d1, null as unknown as Date], d1);
    click([d1, d5], d5); // 完成 [7/1, 7/5]
    click([d3, null as unknown as Date], d3); // 開新區間：先點 7/3
    click([d1, null as unknown as Date], d1); // 反向點 7/1

    expect(control.value).toEqual([d1, d3]);
  });

  it('關閉面板會清掉未完成的起點，下次點選視為新起點', () => {
    click([d3, null as unknown as Date], d3); // 點了 7/3 但沒點第二個
    picker.onClose.emit(); // 關閉面板
    click([d5, null as unknown as Date], d5); // 重新點 7/5：應視為新起點，而非配對 7/3

    expect(control.value).toEqual([d5, null]);
  });
});
