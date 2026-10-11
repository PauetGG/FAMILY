export type Unit = "g" | "ml" | "unit";
export type Meal = "breakfast" | "lunch" | "snack" | "dinner";

export const UNIT_LABEL: Record<Unit, string> = { g: "g", ml: "ml", unit: "u." };

export const MEALS: { key: Meal; label: string }[] = [
  { key: "breakfast", label: "Esmorzar" },
  { key: "lunch", label: "Dinar" },
  { key: "snack", label: "Berenar" },
  { key: "dinner", label: "Sopar" },
];

export type Profile = { id: string; display_name: string };

export type Ingredient = { id: string; name: string; unit: Unit };

export type DishIngredient = {
  ingredient_id: string;
  quantity: number;
  ingredients: Ingredient;
};

export type Dish = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  owner?: Profile | null;
  dish_ingredients?: DishIngredient[];
};

export type DietEntry = {
  id: string;
  user_id: string;
  date: string;
  meal: Meal;
  dish_id: string;
  servings: number;
  dishes: {
    id: string;
    name: string;
    // Ingredients per ració, per mostrar-los a sota del plat al calendari
    dish_ingredients?: { quantity: number; ingredients: { name: string; unit: Unit } | null }[];
  } | null;
};

// Persona que surt al calendari: tu i la gent dels teus grups (canEdit si t'ha donat permís)
export type CalendarPerson = { id: string; name: string; canEdit: boolean };

export type Group = { id: string; name: string; invite_code: string; created_by: string };

// Part d'un grup, per exemple una parella dins del pis
export type Subgroup = { id: string; group_id: string; name: string; subgroup_members: { user_id: string }[] };

// Consum fix: el que es menja igual cada dia i no va al calendari (per exemple, el gos)
export type RecurringItem = {
  id: string;
  meal: Meal | null;
  ingredient_id: string;
  quantity: number;
  position: number;
  ingredients: Ingredient | null;
};

export type RecurringPlan = {
  id: string;
  group_id: string;
  subgroup_id: string | null;
  name: string;
  recurring_items: RecurringItem[];
};