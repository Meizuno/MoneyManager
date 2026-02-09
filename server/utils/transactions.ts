import { createError } from "h3";
import type { TransactionInput } from "~/types/transaction";

export const normalizeCategory = (category?: string | null) => {
  const trimmed = (category ?? "").trim();
  return trimmed.length > 0 ? trimmed : "other";
};

export const normalizeTransactionType = (value?: string | null) => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "other";

  const ascii = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map: Record<string, string> = {
    other: "other",
    income: "income",
    expense: "expense",
    transfer: "transfer",
    fee: "fee",
    conversion: "conversion",
    refund: "refund",
    credit: "income",
    debit: "expense",
    withdrawal: "expense",
    payment: "expense",
    cash: "expense",
    salary: "income",
    refunds: "refund",
    fees: "fee",
    exchange: "conversion",
    swap: "conversion",
    "transfer in": "transfer",
    "transfer out": "transfer",
    "incoming transfer": "transfer",
    "outgoing transfer": "transfer",
    prijem: "income",
    vydaj: "expense",
    vydaje: "expense",
    poplatek: "fee",
    prevod: "transfer",
    vratka: "refund",
    konverze: "conversion",
    smena: "conversion",
  };

  return map[ascii] ?? "other";
};

export const expandTransactionTypeFilter = (value?: string | null) => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "all") return [];

  const ascii = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const aliases: Record<string, string[]> = {
    other: ["other"],
    income: ["income", "credit", "salary", "prijem"],
    expense: ["expense", "debit", "withdrawal", "payment", "cash", "vydaj", "vydaje"],
    transfer: [
      "transfer",
      "transfer in",
      "transfer out",
      "incoming transfer",
      "outgoing transfer",
      "prevod",
    ],
    fee: ["fee", "fees", "poplatek"],
    conversion: ["conversion", "exchange", "swap", "konverze", "smena"],
    refund: ["refund", "refunds", "vratka"],
  };

  return aliases[ascii] ?? [ascii];
};

export const normalizeTransactionInput = (input: TransactionInput) => {
  const date = (input.date ?? "").trim();
  const name = (input.name ?? "").trim();
  const amountRaw = input.amount ?? "";
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : Number(
          String(amountRaw)
            .replace(/\s/g, "")
            .replace(",", "."),
        );

  if (!date || !name || !Number.isFinite(amount)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid transaction payload.",
    });
  }

  const currency =
    typeof input.currency === "string" && input.currency.trim().length > 0
      ? input.currency.trim()
      : null;

  return {
    date,
    name,
    amount,
    currency,
    type: normalizeTransactionType(input.type),
    category: normalizeCategory(input.category),
  };
};
