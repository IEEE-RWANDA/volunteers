"use client";

import { useState, type ReactNode } from "react";

export default function StudentBranchTabs({ branches, panels }: {
  branches: { id: string; name: string; logo: ReactNode }[];
  panels: ReactNode[];
}) {
  const [selected, setSelected] = useState(branches[0]?.id);
  const current = branches.some(branch => branch.id === selected) ? selected : branches[0]?.id;
  return (
    <>
      <div role="group" aria-label="Select student branch" className="mt-4 flex flex-wrap justify-center gap-3">
        {branches.map(branch => (
          <button key={branch.id} type="button" aria-pressed={current === branch.id}
            aria-controls={`branch-panel-${branch.id}`} onClick={() => setSelected(branch.id)}
            className={`flex min-h-14 max-w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-semibold ${current === branch.id ? "border-blue bg-[#e7f3fb] text-blue" : "border-line bg-white text-navy hover:bg-paper-2"}`}>
            {branch.logo}
            <span className="min-w-0 wrap-anywhere">{branch.name}</span>
          </button>
        ))}
      </div>
      {branches.map((branch, index) => (
        <ul key={branch.id} id={`branch-panel-${branch.id}`} hidden={current !== branch.id}
          aria-label={branch.name} className="mt-4 list-none">
          {panels[index]}
        </ul>
      ))}
    </>
  );
}
