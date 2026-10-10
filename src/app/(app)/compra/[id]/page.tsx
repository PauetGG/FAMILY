import { Suspense } from "react";
import ShoppingList from "./ShoppingList";

export default function ShoppingListPage() {
  return (
    <Suspense fallback={<p className="text-ink/70">Carregant la llista...</p>}>
      <ShoppingList />
    </Suspense>
  );
}
