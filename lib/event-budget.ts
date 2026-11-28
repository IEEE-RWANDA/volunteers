export type BudgetItem = { description: string; quantity: string; unitCost: string };
export type EventBudget = { total: string; items: BudgetItem[] };

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
  return { total: budget.total, items: budget.items.map(item => ({ description: item.description.trim(), quantity: item.quantity, unitCost: item.unitCost })) };
}
