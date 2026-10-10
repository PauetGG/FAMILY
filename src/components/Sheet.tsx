"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Finestra que puja des de baix al mòbil i surt centrada a iPad i ordinador
export default function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto md:m-auto w-full max-w-none md:max-w-xl max-h-[92dvh] bg-card text-ink rounded-t-[22px] md:rounded-[18px] md:border-2 md:border-ink p-0 backdrop:bg-black/60"
    >
      <div className="sticky top-0 bg-card flex items-center justify-between gap-4 px-5 pt-5 pb-3 border-b-2 border-line">
        <h2 className="text-2xl font-extrabold">{title}</h2>
        <button type="button" onClick={onClose} className="btn btn-ghost" aria-label="Tanca">
          <X size={22} aria-hidden />
        </button>
      </div>
      <div className="px-5 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
