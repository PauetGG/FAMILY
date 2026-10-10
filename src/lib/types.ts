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
  dishes: { id: string; name: string } | null;
};

export type Group = { id: string; name: string; invite_code: string; created_by: string };
