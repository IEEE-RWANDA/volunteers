"use client";

import { useState } from "react";
import { budgetCents, itemCents, type EventBudget } from "@/lib/event-budget";
import { formatUsd } from "@/lib/fund-amounts";

const input = "w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 font-normal";
export default function EventBudgetFields({ initial, totalOnly = false }: { initial?: EventBudget; totalOnly?: boolean }) {
  const [total, setTotal] = useState(initial?.total ?? "0");
  const [items, setItems] = useState(initial?.items ?? []);
  const planned = items.reduce((sum, item) => sum + (itemCents(item) ?? 0), 0);
  return <div className="space-y-4">
    <input type="hidden" name="eventBudget" value={JSON.stringify({ total, items })} />
    <label className="block font-semibold">Total event budget (USD)<input type="number" min="0" max="999999999.99" step="0.01" required className={input} value={total} onChange={e => setTotal(e.target.value)} /></label>
    {!totalOnly && <><div className="scrollable-table" role="region" aria-label="Budget spreadsheet" tabIndex={0}>
      <table className="w-full min-w-[36rem] text-left text-sm"><thead><tr><th className="p-2">Budget item</th><th className="p-2 w-24">Quantity</th><th className="p-2 w-32">Unit cost (USD)</th><th className="p-2">Amount</th><th className="p-2"><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{items.map((item, index) => <tr key={index}>
        <td className="p-1"><input aria-label={`Item ${index + 1} description`} required maxLength={200} className={input} value={item.description} onChange={e => setItems(items.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} /></td>
        <td className="p-1"><input aria-label={`Item ${index + 1} quantity`} type="number" min="0" max="999999" step="1" required className={input} value={item.quantity} onChange={e => setItems(items.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} /></td>
        <td className="p-1"><input aria-label={`Item ${index + 1} unit cost`} type="number" min="0" max="999999999.99" step="0.01" required className={input} value={item.unitCost} onChange={e => setItems(items.map((row, i) => i === index ? { ...row, unitCost: e.target.value } : row))} /></td>
        <td className="p-2 whitespace-nowrap">{formatUsd(itemCents(item) ?? 0)}</td><td className="p-2"><button type="button" className="action-link" aria-label={`Remove budget item ${index + 1}`} onClick={() => setItems(items.filter((_, i) => i !== index))}>Remove</button></td>
      </tr>)}</tbody><tfoot><tr><th colSpan={3} className="p-2">Planned total</th><td colSpan={2} className="p-2 whitespace-nowrap">{formatUsd(planned)}</td></tr></tfoot></table>
    </div>
    <button type="button" className="action-link" disabled={items.length >= 100} onClick={() => setItems([...items, { description: "", quantity: "1", unitCost: "0" }])}>+ Add budget item</button>
    <p className="text-sm text-ink-soft">Unallocated budget: {formatUsd((budgetCents(total) ?? 0) - planned)}. You can revise your plan as the activity develops.</p></>}
  </div>;
}
