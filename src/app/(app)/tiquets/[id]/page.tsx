import { Suspense } from "react";
import ReceiptEditor from "./ReceiptEditor";

export default function ReceiptPage() {
  return (
    <Suspense fallback={<p className="text-ink/70">Carregant el tiquet...</p>}>
      <ReceiptEditor />
    </Suspense>
  );
}
