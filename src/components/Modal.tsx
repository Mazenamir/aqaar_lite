"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="modal-title"
      className="rounded-2xl p-0 bg-surface-container-lowest text-on-surface shadow-2xl max-w-lg w-full backdrop:bg-black/50 m-auto border border-outline-variant/30"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-low">
        <h2 id="modal-title" className="text-base font-bold text-on-surface">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
          aria-label="إغلاق النافذة"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
