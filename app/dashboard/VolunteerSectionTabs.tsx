"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export default function VolunteerSectionTabs({ section, tabs, initial }: { section: string; tabs: { id: string; label: string; content: ReactNode }[]; initial: string }) {
  const params = useSearchParams();
  const selected = tabs.find(tab => tab.id === params.get("tab"))?.id ?? initial;
  return <>
    <nav aria-label={section === "funding" ? "Funding and reporting" : "Event and activity sections"} className="dashboard-nav mb-5">
      {tabs.map(tab => <a key={tab.id} href={`/?section=${section}&tab=${tab.id}`} aria-current={selected === tab.id ? "page" : undefined} onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab.id);
        url.hash = "";
        window.history.pushState(null, "", url);
      }}>{tab.label}</a>)}
    </nav>
    {tabs.map(tab => <div key={tab.id} hidden={selected !== tab.id}>{tab.content}</div>)}
  </>;
}
