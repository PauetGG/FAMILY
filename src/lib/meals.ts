// Àpats personalitzables de cada usuari (taula "meals")
export type UserMeal = {
  id: string;
  user_id: string;
  name: string;
  position: number;
};

export const MEAL_SELECT = "id, user_id, name, position";

// Una fila del calendari: un nom d'àpat i, per a cada persona que el té, l'id del seu àpat
export type MealSlot = { name: string; byUser: Map<string, string> };

// Ajunta els àpats de tothom per nom. L'ordre és el de la primera persona (tu)
// i els àpats que només tenen els altres van al final, en l'ordre de cadascú.
export function mealSlots(meals: UserMeal[], peopleOrder: string[]): MealSlot[] {
  const slots: MealSlot[] = [];
  const byName = new Map<string, MealSlot>();
  for (const userId of peopleOrder) {
    const own = meals.filter((m) => m.user_id === userId).sort((a, b) => a.position - b.position);
    for (const m of own) {
      const key = m.name.trim().toLowerCase();
      let slot = byName.get(key);
      if (!slot) {
        slot = { name: m.name, byUser: new Map() };
        byName.set(key, slot);
        slots.push(slot);
      }
      slot.byUser.set(userId, m.id);
    }
  }
  return slots;
}