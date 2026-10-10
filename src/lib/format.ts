import type { Unit } from "./types";

const nf = new Intl.NumberFormat("ca", { maximumFractionDigits: 2 });

// 1500 g → 1,5 kg; 2000 ml → 2 l; 3 unitats → 3 u.
export function formatQty(q: number | null | undefined, unit: Unit | null | undefined): string {
  if (q == null || unit == null) return "";
  const n = Number(q);
  if (unit === "g" && n >= 1000) return `${nf.format(n / 1000)} kg`;
  if (unit === "ml" && n >= 1000) return `${nf.format(n / 1000)} l`;
  if (unit === "unit") return `${nf.format(n)} u.`;
  return `${nf.format(n)} ${unit}`;
}

const MONTHS = ["gen.", "febr.", "març", "abr.", "maig", "juny", "jul.", "ag.", "set.", "oct.", "nov.", "des."];

export function formatRange(from: string | null, to: string | null): string {
  if (!from || !to) return "";
  const [, m1, d1] = from.split("-").map(Number);
  const [, m2, d2] = to.split("-").map(Number);
  return `${d1} ${MONTHS[m1 - 1]} a ${d2} ${MONTHS[m2 - 1]}`;
}
