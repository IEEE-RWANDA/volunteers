"use client";

import { useState, type ReactNode } from "react";

export default function FundBalanceTabs({ balances, releases }: { balances: ReactNode; releases: ReactNode }) {
  const [current, setCurrent] = useState("balances");
  return (
    <>
      <div className="mt-4 flex flex-wrap justify-center gap-1" aria-label="Fund balances views" role="group">
        {[{ id: "balances", label: "Funding balances" }, { id: "releases", label: "Release history" }].map(tab => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={current === tab.id}
            aria-controls={`treasury-${tab.id}`}
            onClick={() => setCurrent(tab.id)}
            className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${current === tab.id ? "bg-[#e7f3fb] text-blue shadow-[inset_0_-3px_var(--color-blue)]" : "text-ink-soft hover:bg-paper-2"}`}
          >{tab.label}</button>
        ))}
      </div>
      <div id="treasury-balances" hidden={current !== "balances"}>{balances}</div>
      <div id="treasury-releases" hidden={current !== "releases"}>{releases}</div>
    </>
  );
}
