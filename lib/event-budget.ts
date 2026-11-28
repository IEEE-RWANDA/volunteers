export type BudgetItem = { description: string; quantity: string; unitCost: string; category?: string };
export type EventBudget = { total: string; items: BudgetItem[]; currency?: "RWF" | "USD"; exchangeRate?: string; fundingSources?: { name: string; amount: string; currency: "RWF" | "USD" }[] };
