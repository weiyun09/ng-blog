const pad = (n: number) => String(n).padStart(2, '0');

// Normalize a range to [earlier, later]; PrimeNG range mode stores clicks in order,
// so reverse selection yields [later, earlier] and would make from > to.
export function sortDateRange(range: Date[] | null): Date[] | null {
  if (range?.[0] && range?.[1] && range[0].getTime() > range[1].getTime()) {
    return [range[1], range[0]];
  }
  return range;
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
