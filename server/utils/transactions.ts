import { createError } from "h3";
import type { TransactionInput } from "~/types/transaction";

export const normalizeCategory = (category?: string | null) => {
  const trimmed = (category ?? "").trim();
  return trimmed.length > 0 ? trimmed : "other";
};

export const normalizeTransactionType = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "other";
};

export const normalizeTransactionInput = (input: TransactionInput) => {
  const date = (input.date ?? "").trim();
  const description = (input.description ?? "").trim();
  const amountRaw = input.amount ?? "";
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : Number(
          String(amountRaw)
            .replace(/\s/g, "")
            .replace(",", "."),
        );

  if (!date || !description || !Number.isFinite(amount)) {
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
    description,
    amount,
    currency,
    type: normalizeTransactionType(input.type),
    category: normalizeCategory(input.category),
  };
};
