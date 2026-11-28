"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import type { OrganizerOption } from "@/lib/volunteer-intake";

export default function RequestPicker({ name, label, placeholder, searchLabel, emptyMessage, options, selectedIds, onChange, field, renderSelected, summary, multiple = true, onOpen, onCancel }: {
  name: string; label: string; placeholder: string; searchLabel: string; emptyMessage: string;
  options: OrganizerOption[]; selectedIds: string[]; onChange: (ids: string[]) => void; field: string;
  multiple?: boolean;
  onOpen?: () => void;
  onCancel?: () => void;
  renderSelected?: (option: OrganizerOption) => ReactNode;
  summary?: (option: OrganizerOption) => string;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const query = search.trim().toLowerCase();
  const matches = options.filter(option => `${option.name} ${option.committee ?? ""}`.toLowerCase().includes(query));
  const selected = options.filter(option => selectedIds.includes(option.id));
  const pendingSelected = options.filter(option => pendingIds.includes(option.id));
  function cancel() {
    onCancel?.();
    dialog.current?.close();
  }
  return (
    <div>
      <span id={`${id}-label`} className="font-semibold text-navy">{label}</span>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-labelledby={`${id}-label ${id}-value`}
        className={`${field} flex items-center justify-between gap-3 text-left disabled:opacity-60`}
        disabled={!options.length}
        onClick={() => { setPendingIds([...selectedIds]); onOpen?.(); dialog.current?.showModal(); }}
      >
        <span id={`${id}-value`} className="min-w-0 wrap-anywhere">
          {selected.length ? selected.map(member => summary?.(member) ?? member.name).join(", ") : placeholder}
        </span>
        <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {!options.length && <p className="mt-2 text-ink-soft">{emptyMessage}</p>}
      {selected.map(member => <input key={member.id} type="hidden" name={name} value={member.id} />)}
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onClose={() => setSearch("")}
        onCancel={event => { event.preventDefault(); cancel(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/45"
      >
        <div className="flex max-h-[80dvh] flex-col gap-4 p-5 sm:p-6">
          <h2 id={`${id}-title`} className="text-lg font-semibold text-navy">{placeholder}</h2>
          <input
            type="search"
            aria-label={searchLabel}
            placeholder={searchLabel}
            className={field}
            value={search}
            autoFocus
            onChange={event => setSearch(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
          <ul aria-label={label} className="min-h-0 max-h-64 overflow-y-auto overscroll-contain divide-y divide-line rounded-md border border-line">
            {matches.map(member => (
              <li key={member.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-paper-2">
                  <input
                    className="mt-0.5 size-4 shrink-0 accent-blue"
                    type="checkbox"
                    checked={pendingIds.includes(member.id)}
                    onChange={event => {
                      const checked = event.target.checked;
                      setPendingIds(checked ? multiple ? [...pendingIds, member.id] : [member.id] : pendingIds.filter(id => id !== member.id));
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block wrap-anywhere font-semibold text-navy">{member.name}</span>
                    {member.committee && <span className="block wrap-anywhere text-xs text-ink-soft">{member.committee}</span>}
                  </span>
                </label>
                {pendingIds.includes(member.id) && renderSelected?.(member)}
              </li>
            ))}
            {!matches.length && <li className="px-3 py-3 text-ink-soft">No results match your search.</li>}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="text-ink-soft">{pendingSelected.length} selected</p>
            <div className="flex gap-2">
              <button type="button" className="btn border border-line bg-white text-navy" onClick={cancel}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => { onChange(pendingIds); dialog.current?.close(); }}>Done</button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
