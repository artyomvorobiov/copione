/** Dates in the app are local calendar days formatted as YYYY-MM-DD. */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseISODate(value);
  return toISODate(d) === value;
}

export function yearOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) && y > 0 ? y : null;
}

/** Month index 0..11 of a YYYY-MM-DD string. */
export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7)) - 1;
}

/** Local calendar day of a timestamp (ISO string with time). */
export function localDayOf(timestamp: string): string {
  return toISODate(new Date(timestamp));
}

/** True when an air date is today or in the past. Unknown dates are not aired. */
export function isAired(airDate: string | null | undefined, today: string = todayISO()): boolean {
  if (!airDate) return false;
  return airDate.slice(0, 10) <= today;
}

export function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseISODate(toIso).getTime() - parseISODate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}
