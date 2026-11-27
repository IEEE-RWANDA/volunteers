"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const tabs = [
  { id: "events", label: "Event submissions", anchor: "admin-events" },
  { id: "funding", label: "Funding requests", anchor: "admin-funding-panel" },
  { id: "reporting", label: "Reporting", anchor: "admin-reports" },
  { id: "balances", label: "Fund balances", anchor: "fund-balances" },
  { id: "organizations", label: "Organizations", anchor: "volunteer-units" },
  { id: "roster", label: "Volunteer roster", anchor: "team-hours" },
] as const;

export default function AdminWorkflowTabs({ panels }: { panels: Partial<Record<(typeof tabs)[number]["id"], ReactNode>> }) {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".dashboard-topbar");
    const nav = navigation.current;
    if (!header || !nav) return;
    const update = () => {
      document.documentElement.style.setProperty("--dashboard-header-height", `${header.offsetHeight}px`);
      document.documentElement.style.setProperty("--admin-tabs-height", `${nav.offsetHeight}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(header);
    observer.observe(nav);
    update();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--dashboard-header-height");
      document.documentElement.style.removeProperty("--admin-tabs-height");
    };
  }, []);
  const tab = useSearchParams().get("tab");
  const current = tabs.find(item => item.id === tab && panels[item.id])?.id ?? "events";
  const previousTab = useRef(current);
  useEffect(() => {
    if (previousTab.current === current) return;
    previousTab.current = current;
    const active = tabs.find(item => item.id === current);
    if (active) document.getElementById(active.anchor)?.scrollIntoView({ block: "start" });
  }, [current]);

  return (
    <>
      <nav ref={navigation} aria-label="Admin workflows" className="dashboard-nav admin-workflow-nav">
        {tabs.filter(item => panels[item.id]).map(item => {
          const href = `/?section=team&tab=${item.id}`;
          return (
            <a
              key={item.id}
              href={`${href}#${item.anchor}`}
              aria-current={current === item.id ? "page" : undefined}
              onClick={event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                if (current !== item.id) window.history.pushState(null, "", href);
              }}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
      {tabs.filter(item => panels[item.id]).map(item => <div key={item.id} hidden={current !== item.id}>{panels[item.id]}</div>)}
    </>
  );
}
