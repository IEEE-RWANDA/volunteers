"use client";

import { Fragment, useState } from "react";
import { budgetCategories, budgetCents, budgetMoney, budgetRate, budgetTotals, itemCents, templateBudget, type EventBudget } from "@/lib/event-budget";
import { formatUsd } from "@/lib/fund-amounts";

const input = "w-full min-w-0 rounded-none border border-transparent bg-transparent px-1 py-1 hover:border-line focus:border-blue focus:bg-white font-normal text-ink";
const rwf = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "RWF", maximumFractionDigits: 2 }).format(cents / 100);
export default function EventBudgetFields({ initial, totalOnly = false }: { initial?: EventBudget; totalOnly?: boolean }) {
  const [budget, setBudget] = useState<EventBudget>(() => !totalOnly && (!initial || (!initial.items.length && !initial.currency)) ? { ...templateBudget(), total: initial?.total ?? "0" } : initial ?? { total: "0", items: [] });
  const rate = budgetRate(budget);
  const totals = budgetTotals(budget);
  const currency = budget.currency ?? "USD";
  const items = budget.items;
  const sources = budget.fundingSources ?? [];
  const categories = [...new Set([...budgetCategories, ...items.map(item => item.category ?? "MISCELLANEOUS")])];
  function updateItem(index: number, patch: Partial<EventBudget["items"][number]>) {
    setBudget({ ...budget, items: items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  }
  return <div className="space-y-4">
    <input type="hidden" name="eventBudget" value={JSON.stringify(budget)} />
    <label className="block font-semibold">Total event budget (USD)<input type="number" min="0" max="999999999.99" step="0.01" required className={input} value={budget.total} onChange={e => setBudget({ ...budget, total: e.target.value })} /></label>
    {!totalOnly && <>
      <button type="button" className="action-link" disabled={!rate} onClick={() => setBudget({ ...budget, total: (totals.required.usd / 100).toFixed(2) })}>Use calculated total as event budget</button>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="font-semibold">Exchange rate (RWF per USD)<input aria-label="Exchange rate (RWF per USD)" type="number" min="0.000001" max="999999.999999" step="0.000001" required className={input} value={budget.exchangeRate ?? "1476.6"} onChange={e => setBudget({ ...budget, exchangeRate: e.target.value })} /></label>
        <p className="self-end text-sm text-ink-soft">Use your activity’s agreed exchange rate. Unit prices are entered in {currency}.</p>
      </div>
      {!rate && <p role="alert" className="text-sm text-red-700">Enter a positive exchange rate to calculate currency conversions.</p>}
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[1.65fr_1fr]">
        <section className="min-w-0" aria-label="Final budget">
          <h3 className="bg-[#0b5394] px-3 py-3 font-bold text-white">FINAL BUDGET</h3>
          <div className="scrollable-table" role="region" aria-label="Budget spreadsheet" tabIndex={0}>
            <table className="w-full min-w-[38rem] text-left text-sm"><thead style={{ backgroundColor: "#9fc5e8" }}><tr>{["Item", "Quantity", `Unit Price (${currency})`, "Total Cost (RWF)", "Total Cost (USD)", ""].map((label, i) => <th key={i} scope="col" className="p-2">{label || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
              <tbody>{categories.map(category => {
                const group = items.map((item, index) => ({ item, index })).filter(({ item }) => (item.category ?? "MISCELLANEOUS") === category);
                const subtotal = budgetMoney(group.reduce((sum, { item }) => sum + (itemCents(item) ?? 0), 0), currency, rate ?? 1);
                return <Fragment key={category}><tr className="bg-paper-2"><th colSpan={6} scope="rowgroup" className="px-2 py-3 text-navy">{category}</th></tr>
                  {group.map(({ item, index }) => {
                    const money = budgetMoney(itemCents(item) ?? 0, currency, rate ?? 1);
                    return <tr key={index} className="border-b border-line">
                      <td className="min-w-44 p-1"><input aria-label={`Item ${index + 1} description`} required maxLength={200} className={input} value={item.description} onChange={e => updateItem(index, { description: e.target.value })} /></td>
                      <td className="min-w-16 p-1"><input aria-label={`Item ${index + 1} quantity`} type="number" min="0" max="999999" step="1" required className={input} value={item.quantity} onChange={e => updateItem(index, { quantity: e.target.value })} /></td>
                      <td className="min-w-24 p-1"><input aria-label={`Item ${index + 1} unit cost`} type="number" min="0" max="999999999.99" step="0.01" required className={input} value={item.unitCost} onChange={e => updateItem(index, { unitCost: e.target.value })} /></td>
                      <td className="whitespace-nowrap p-2">{rate ? rwf(money.rwf) : "—"}</td><td className="whitespace-nowrap p-2">{rate ? formatUsd(money.usd) : "—"}</td>
                      <td className="p-2"><button type="button" className="action-link" aria-label={`Remove budget item ${index + 1}`} onClick={() => setBudget({ ...budget, items: items.filter((_, i) => i !== index) })}>Remove</button></td>
                    </tr>;
                  })}
                  <tr className="bg-paper-2 font-semibold"><th colSpan={3} scope="row" className="p-2">{category === "PRINTING AND BRANDING" ? "Printing" : category === "PHOTOGRAPHY AND VIDEOGRAPHY" ? "Media" : category === "CATERING" ? "Catering" : "Miscellaneous"} Subtotal</th><td className="whitespace-nowrap p-2">{rate ? rwf(subtotal.rwf) : "—"}</td><td className="whitespace-nowrap p-2">{rate ? formatUsd(subtotal.usd) : "—"}</td><td /></tr>
                  <tr><td colSpan={6} className="p-2"><button type="button" className="action-link" disabled={items.length >= 100} onClick={() => setBudget({ ...budget, items: [...items, { category, description: "", quantity: "1", unitCost: "0" }] })}>+ Add {category.toLowerCase()} item</button></td></tr>
                </Fragment>;
              })}</tbody>
              <tfoot className="bg-[#0b5394] font-bold text-white"><tr><th colSpan={3} scope="row" className="p-3">OVERALL TOTAL BUDGET</th><td className="whitespace-nowrap p-3">{rate ? rwf(totals.required.rwf) : "—"}</td><td className="whitespace-nowrap p-3">{rate ? formatUsd(totals.required.usd) : "—"}</td><td /></tr></tfoot>
            </table>
          </div>
        </section>
        <section className="min-w-0" aria-label="Sources of funding">
          <h3 className="bg-[#0b5394] px-3 py-3 font-bold text-white">SOURCES OF FUNDING</h3>
          <div className="scrollable-table" role="region" aria-label="Budget funding sources" tabIndex={0}>
            <table className="w-full min-w-[24rem] text-left text-sm"><thead style={{ backgroundColor: "#9fc5e8" }}><tr>{["Funding source", "Amount (RWF)", "Amount (USD)", ""].map((label, i) => <th key={i} scope="col" className="p-2">{label || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
              <tbody>{sources.map((source, index) => {
                const money = budgetMoney(budgetCents(source.amount) ?? 0, source.currency, rate ?? 1);
                function update(patch: Partial<typeof source>) { setBudget({ ...budget, fundingSources: sources.map((row, i) => i === index ? { ...row, ...patch } : row) }); }
                return <tr key={index}><td className="min-w-28 p-1"><input aria-label={`Funding source ${index + 1}`} required maxLength={200} className={input} value={source.name} onChange={e => update({ name: e.target.value })} /></td>
                  {(["RWF", "USD"] as const).map(unit => <td key={unit} className="min-w-24 p-1"><input aria-label={`Funding source ${index + 1} amount (${unit})`} type="number" min="0" max="999999999.99" step="0.01" required className={input} value={source.currency === unit ? source.amount : rate ? ((unit === "RWF" ? money.rwf : money.usd) / 100).toFixed(2) : ""} onChange={e => update({ currency: unit, amount: e.target.value })} /></td>)}
                  <td className="p-2"><button type="button" className="action-link" aria-label={`Remove funding source ${index + 1}`} onClick={() => setBudget({ ...budget, fundingSources: sources.filter((_, i) => i !== index) })}>Remove</button></td></tr>;
              })}</tbody>
              <tfoot>{[["Total funding", totals.funding], ["Budget required", totals.required], ["Funding gap / (surplus)", totals.gap]].map(([label, values]) => { const money = values as { rwf: number; usd: number }; return <tr key={String(label)} className="border-t border-line bg-paper-2 font-semibold"><th className="p-2" scope="row">{String(label)}</th><td className="whitespace-nowrap p-2">{rate ? rwf(money.rwf) : "—"}</td><td className="whitespace-nowrap p-2">{rate ? formatUsd(money.usd) : "—"}</td><td /></tr>; })}</tfoot>
            </table>
          </div>
          <button type="button" className="action-link mt-3" disabled={sources.length >= 50} onClick={() => setBudget({ ...budget, fundingSources: [...sources, { name: "", amount: "0", currency: "USD" }] })}>+ Add funding source</button>
          <p className="mt-3 text-sm text-ink-soft">Planning sources do not assign funds or change treasury balances. A positive difference is a surplus; a negative difference is a shortfall.</p>
        </section>
      </div>
      <p className="text-sm text-ink-soft">Change quantities, unit prices, or exchange rate to recalculate the budget. Unallocated budget: {formatUsd((budgetCents(budget.total) ?? 0) - totals.required.usd)}.</p>
    </>}
  </div>;
}
