"use client";

import { useId, useRef, type ReactNode } from "react";

const icons = {
  plus: <path d="M12 5v14M5 12h14" />,
  person: <><path d="M15 19a6 6 0 0 0-12 0" /><circle cx="9" cy="7" r="4" /><path d="M19 8v8m-4-4h8" /></>,
  role: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18M10 12v2h4v-2" /></>,
} as const;

export default function ActionModal({ label, title, icon, children }: {
  label: string;
  title: string;
  icon: keyof typeof icons;
  children: ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="inline-grid size-9 shrink-0 place-items-center rounded-md border border-line bg-paper text-blue transition-colors hover:border-blue hover:bg-paper-2"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icons[icon]}
        </svg>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={id}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/45"
      >
        <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={id} className="font-display text-xl font-bold text-navy">{title}</h2>
            <button
              type="button"
              className="inline-grid size-9 shrink-0 place-items-center rounded-md text-ink-soft hover:bg-paper-2 hover:text-navy"
              aria-label="Close dialog"
              onClick={() => dialog.current?.close()}
            >
              <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      </dialog>
    </>
  );
}
