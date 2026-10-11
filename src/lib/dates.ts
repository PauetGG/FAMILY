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

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // dilluns = 0
  return addDays(r, -dow);
}

// Dies que es veuen a la graella del mes: de dilluns de la primera setmana
// a diumenge de l'última (5 o 6 setmanes)
export function monthGrid(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const start = mondayOf(first);
  const end = addDays(mondayOf(last), 6);
  const days: Date[] = [];
  for (let x = start; x <= end; x = addDays(x, 1)) days.push(x);
  return days;
}

export const dayIndex = (d: Date) => (d.getDay() + 6) % 7; // dilluns = 0

export const DAY_SHORT = ["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."];
export const DAY_LONG = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge"];
const MONTHS = ["gen.", "febr.", "març", "abr.", "maig", "juny", "jul.", "ag.", "set.", "oct.", "nov.", "des."];
const MONTHS_LONG = [
  "gener",
  "febrer",
  "març",
  "abril",
  "maig",
  "juny",
  "juliol",
  "agost",
  "setembre",
  "octubre",
  "novembre",
  "desembre",
];

export function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const a = `${monday.getDate()} ${MONTHS[monday.getMonth()]}`;
  const b = `${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;
  return `${a} a ${b}`;
}

export function monthLabel(d: Date): string {
  const m = MONTHS_LONG[d.getMonth()];
  return `${m[0].toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
}

// "Diumenge 11 d'octubre" / "Dilluns 5 de gener"
export function dayLabel(d: Date): string {
  const m = MONTHS_LONG[d.getMonth()];
  const de = /^[aeiou]/.test(m) ? "d'" : "de ";
  return `${DAY_LONG[dayIndex(d)]} ${d.getDate()} ${de}${m}`;
}