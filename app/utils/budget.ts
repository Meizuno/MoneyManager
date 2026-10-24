import type { Transaction } from "#shared/schemas/transaction";
import type { IncomeCategory, SplitRule } from "~/composables/useCategories";
import { categoryHex } from "./colors";

// The overview's arithmetic, kept out of the components so it can be
// tested on its own. Every expense category plans a percent of the
// period's income; the budget compares that with what was spent.

export type BudgetRow = {
  id: number;
  label: string;
  color: string;
  planned: number;
  spent: number;
};

export type IncomeRow = {
  id: number;
  label: string;
  color: string;
  amount: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;

function sumByCategory(transactions: Transaction[], type: Transaction["type"]) {
  const sums = new Map<number, number>();
  for (const tx of transactions) {
    if (tx.type === type) sums.set(tx.category.id, (sums.get(tx.category.id) ?? 0) + tx.amount);
  }
  return sums;
}

/** Each expense category, in the user's order: its share of `income`, and what was spent. */
export function budgetRows(categories: SplitRule[], transactions: Transaction[], income: number): BudgetRow[] {
  const spent = sumByCategory(transactions, "expense");
  return categories.map(c => ({
    id: c.id,
    label: c.label,
    color: categoryHex(c.color),
    planned: cents((income * Number(c.percent)) / 100),
    spent: cents(spent.get(c.id) ?? 0),
  }));
}

/** Each income category with what came in through it. */
export function incomeRows(categories: IncomeCategory[], transactions: Transaction[]): IncomeRow[] {
  const received = sumByCategory(transactions, "income");
  return categories.map(c => ({
    id: c.id,
    label: c.label,
    color: categoryHex(c.color),
    amount: cents(received.get(c.id) ?? 0),
  }));
}

/** The part of the income no expense category plans for, when there is one. */
export function unallocated(categories: SplitRule[], income: number): { percent: number; amount: number } | null {
  const percent = 100 - categories.reduce((s, c) => s + Number(c.percent), 0);
  return percent > 0 ? { percent, amount: cents((income * percent) / 100) } : null;
}
