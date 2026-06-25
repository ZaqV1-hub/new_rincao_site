"use client";

import { useEffect } from "react";

type PainelModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function PainelModal({ title, open, onClose, children }: PainelModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b201b]/55 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-[720px] overflow-hidden rounded-[12px] border border-[#dbe7d7] bg-white shadow-[0_28px_70px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#e4eee0] px-5 py-4">
          <h2 className="text-xl font-black text-[#17351f]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe7d7] text-xl font-black text-[#17351f] hover:bg-[#f6faf3]"
          >
            ×
          </button>
        </div>
        <div className="max-h-[calc(88vh-78px)] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
