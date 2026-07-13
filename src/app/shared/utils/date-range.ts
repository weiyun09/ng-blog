/**
 * 日期區間相關工具，供文章管理與數據分析共用。
 * PrimeNG datepicker range 模式會照點擊順序存值，反向點選會得到 [晚, 早]，
 * 需正規化後再拿去查詢，否則 from > to 會濾出空結果。
 */

/** 將區間正規化為 [早, 晚]，容許使用者反向點選日期。 */
export function sortDateRange(range: Date[] | null): Date[] | null {
  if (range?.[0] && range?.[1] && range[0].getTime() > range[1].getTime()) {
    return [range[1], range[0]];
  }
  return range;
}

/** 將 Date 轉為 YYYY-MM-DD 字串（本地時區）。 */
export function toDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
