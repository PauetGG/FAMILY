// Dates en hora local, sempre en format AAAA-MM-DD (sense passar per UTC)

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // dilluns = 0
  return addDays(r, -dow);
}

export const DAY_SHORT = ["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."];
export const DAY_LONG = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge"];
const MONTHS = ["gen.", "febr.", "març", "abr.", "maig", "juny", "jul.", "ag.", "set.", "oct.", "nov.", "des."];

export function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const a = `${monday.getDate()} ${MONTHS[monday.getMonth()]}`;
  const b = `${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;
  return `${a} a ${b}`;
}
