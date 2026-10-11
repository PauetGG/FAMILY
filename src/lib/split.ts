// Proposa qui paga una línia del tiquet a partir dels articles de la llista amb què
// s'ha relacionat. Si l'arròs era 480 g per a tu i 400 g per a la Laia, el paquet
// es reparteix en aquesta proporció. El que és comú es reparteix entre tot el grup.

export type ItemPart = { for_user_id: string | null; quantity: number | null };

export function proposePayers(parts: ItemPart[], members: string[]): Map<string, number> {
  const weights = new Map<string, number>();
  if (parts.length === 0 || members.length === 0) return weights;

  const useQty = parts.every((p) => p.quantity != null && Number(p.quantity) > 0);

  for (const p of parts) {
    const w = useQty ? Number(p.quantity) : 1;
    if (p.for_user_id) {
      weights.set(p.for_user_id, (weights.get(p.for_user_id) ?? 0) + w);
    } else {
      for (const m of members) weights.set(m, (weights.get(m) ?? 0) + w / members.length);
    }
  }

  // Ho passem a percentatges perquè quedi un número petit i llegible
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  const shares = new Map<string, number>();
  for (const [user, w] of weights) {
    shares.set(user, Math.max(0.01, Math.round((w / total) * 10000) / 100));
  }
  return shares;
}

// Quant paga cadascú: cada línia es divideix segons el pes ("share") de cada persona.
// El cèntim que sobra en arrodonir va a qui té la part més gran de la línia.
export type LineForTotals = { amount: number; payers: { user_id: string; share: number }[] };

export function totalsByPerson(lines: LineForTotals[]): Map<string, number> {
  const cents = new Map<string, number>();
  for (const l of lines) {
    if (l.payers.length === 0) continue;
    const lineCents = Math.round(Number(l.amount) * 100);
    const sum = l.payers.reduce((a, p) => a + Number(p.share), 0);
    let assigned = 0;
    const parts = l.payers.map((p) => {
      const c = Math.floor((lineCents * Number(p.share)) / sum);
      assigned += c;
      return { user: p.user_id, c, share: Number(p.share) };
    });
    const rest = lineCents - assigned;
    parts.sort((a, b) => b.share - a.share);
    parts[0].c += rest;
    for (const p of parts) cents.set(p.user, (cents.get(p.user) ?? 0) + p.c);
  }
  const out = new Map<string, number>();
  for (const [u, c] of cents) out.set(u, c / 100);
  return out;
}
