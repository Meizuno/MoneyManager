import { createError } from "h3";

export const normalizeCategory = (category?: string | null) => {
  const trimmed = (category ?? "").trim();
  return trimmed.length > 0 ? trimmed : "other";
};

export const normalizeTransactionInput = (input: TransactionInput) => {
  const date = (input.date ?? "").trim();
  const name = (input.name ?? "").trim();
  const amountRaw = input.amount ?? "";
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : Number(String(amountRaw).replace(/\s/g, "").replace(",", "."));

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

  const typeRaw = typeof input.type === "string" ? input.type.trim().toLowerCase() : "";
  const type = typeRaw === "income" || typeRaw === "expense" ? typeRaw : (amount >= 0 ? "income" : "expense");

  return {
    date,
    name,
    amount: Math.abs(amount),
    currency,
    type,
    category: normalizeCategory(input.category),
  };
};
