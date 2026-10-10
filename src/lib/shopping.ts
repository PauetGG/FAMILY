// Dos articles són "el mateix" a la llista si són el mateix ingredient (o el mateix nom
// escrit a mà) amb la mateixa unitat. Així es compta igual al llistat i dins la llista.
type ItemLike = {
  ingredient_id: string | null;
  custom_name: string | null;
  unit: string | null;
  checked: boolean;
};

export function itemKey(i: Omit<ItemLike, "checked">): string {
  const base = i.ingredient_id ?? `c:${(i.custom_name ?? "").trim().toLowerCase()}`;
  return `${base}|${i.unit ?? ""}`;
}

// Un article agrupat està al carro quan totes les seves parts hi són
export function progress(items: ItemLike[]): { done: number; total: number } {
  const map = new Map<string, boolean>();
  for (const i of items) {
    const k = itemKey(i);
    map.set(k, (map.get(k) ?? true) && i.checked);
  }
  const values = [...map.values()];
  return { done: values.filter(Boolean).length, total: values.length };
}
