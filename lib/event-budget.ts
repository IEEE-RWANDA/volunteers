export type BudgetItem = { description: string; quantity: string; unitCost: string; category?: string };
export type EventBudget = { total: string; items: BudgetItem[]; currency?: "RWF" | "USD"; exchangeRate?: string; fundingSources?: { name: string; amount: string; currency: "RWF" | "USD" }[] };

export function budgetCents(value: string) {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function itemCents(item: BudgetItem) {
  const cost = budgetCents(item.unitCost);
  const quantity = /^\d{1,6}$/.test(item.quantity) ? Number(item.quantity) : NaN;
  const amount = cost === null ? NaN : cost * quantity;
  return Number.isSafeInteger(amount) ? amount : null;
}
export function parseEventBudget(value: unknown): EventBudget | null {
  if (!value || typeof value !== "object") return null;
  const budget = value as EventBudget;
  if (typeof budget.total !== "string" || budgetCents(budget.total) === null || !Array.isArray(budget.items) || budget.items.length > 100) return null;
  if (budget.items.some(item => !item || typeof item.description !== "string" || !item.description.trim() || item.description.length > 200 || typeof item.quantity !== "string" || typeof item.unitCost !== "string" || itemCents(item) === null)) return null;
  if (!Number.isSafeInteger(budget.items.reduce((sum, item) => sum + itemCents(item)!, 0))) return null;
  if (budget.currency !== undefined && !["USD", "RWF"].includes(budget.currency)) return null;
  if (budget.exchangeRate !== undefined && (typeof budget.exchangeRate !== "string" || budgetRate(budget) === null)) return null;
  if (budget.items.some(item => item.category !== undefined && (typeof item.category !== "string" || item.category.length > 100))) return null;
  if (budget.fundingSources !== undefined && (!Array.isArray(budget.fundingSources) || budget.fundingSources.length > 50 || budget.fundingSources.some(source => !source || typeof source.name !== "string" || !source.name.trim() || source.name.length > 200 || typeof source.amount !== "string" || budgetCents(source.amount) === null || !["USD", "RWF"].includes(source.currency)))) return null;
  const totals = budgetTotals(budget);
  if ([totals.required.rwf, totals.required.usd, totals.funding.rwf, totals.funding.usd].some(value => !Number.isSafeInteger(value))) return null;
  return { total: budget.total, ...(budget.currency ? { currency: budget.currency } : {}), ...(budget.exchangeRate !== undefined ? { exchangeRate: budget.exchangeRate } : {}), ...(budget.fundingSources ? { fundingSources: budget.fundingSources.map(source => ({ name: source.name.trim(), amount: source.amount, currency: source.currency })) } : {}), items: budget.items.map(item => ({ description: item.description.trim(), quantity: item.quantity, unitCost: item.unitCost, ...(item.category ? { category: item.category } : {}) })) };
}

export const budgetCategories = ["PRINTING AND BRANDING", "CATERING", "MISCELLANEOUS", "PHOTOGRAPHY AND VIDEOGRAPHY"] as const;
export function templateBudget(): EventBudget {
  return { total: "0", currency: "RWF", exchangeRate: "1476.6", fundingSources: [], items: [
    ["PRINTING AND BRANDING", ["Branded T-shirts", "Banners", "Attendee Badges", "Attendee handouts, bus labels & materials", "Journal book", "Umbrella", "Pen", "Certificates", "Tote Bags"]],
    ["CATERING", ["Breakfast", "Lunch", "Evening coffee"]],
    ["MISCELLANEOUS", ["Pre-event video lunch", "Local transport (materials & volunteers)"]],
    ["PHOTOGRAPHY AND VIDEOGRAPHY", ["Pre-event multimedia promotion", "Event-day photography and videography"]],
  ].flatMap(([category, labels]) => (labels as string[]).map(description => ({ category: category as string, description, quantity: "1", unitCost: "0" }))) };
}
export function budgetRate(budget: EventBudget) {
  const value = budget.exchangeRate ?? "1476.6";
  return /^\d{1,6}(\.\d{1,6})?$/.test(value) && Number(value) > 0 ? Number(value) : null;
}
export function budgetMoney(cents: number, currency: "RWF" | "USD", rate: number) {
  return { rwf: currency === "RWF" ? cents : Math.round(cents * rate), usd: currency === "USD" ? cents : Math.round(cents / rate) };
}
export function budgetTotals(budget: EventBudget) {
  const rate = budgetRate(budget) ?? 1;
  const expenses = budget.items.reduce((sum, item) => sum + (itemCents(item) ?? 0), 0);
  const required = budgetMoney(expenses, budget.currency ?? "USD", rate);
  const funding = (budget.fundingSources ?? []).reduce((sum, source) => {
    const value = budgetMoney(budgetCents(source.amount) ?? 0, source.currency, rate);
    return { rwf: sum.rwf + value.rwf, usd: sum.usd + value.usd };
  }, { rwf: 0, usd: 0 });
  return { required, funding, gap: { rwf: funding.rwf - required.rwf, usd: funding.usd - required.usd } };
}
