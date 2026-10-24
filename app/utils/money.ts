// Amounts as the app shows them: en-US grouping, two decimals, the ISO
// code in front ("CZK 12,620.27"). Rows without a currency are CZK, the
// app's default (DEFAULT_CURRENCY on the server).
const FALLBACK = "CZK";

function formatter(currency: string | null | undefined, cents: boolean) {
  const code = currency && currency.length === 3 ? currency.toUpperCase() : FALLBACK;
  const digits = cents ? 2 : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  catch {
    // An unknown code still gets a number, just without the currency.
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
}

/** The parts of a formatted amount, for rendering the cents quieter. */
export function moneyParts(amount: number, currency?: string | null, cents = true) {
  return formatter(currency, cents).formatToParts(amount);
}

/** "CZK 1,234.50"; `cents: false` rounds to "CZK 1,235". */
export function formatMoney(amount: number, currency?: string | null, cents = true): string {
  return formatter(currency, cents).format(amount);
}

/** A plain number with grouping and two decimals, no currency. */
export function formatNumber(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Parse what someone typed as an amount: "1 250,50", "1,250.50", "12.5". */
export function parseAmount(text: string): number | null {
  const compact = text.replace(/\s/g, "");
  if (!compact) return null;
  // A comma followed by one or two digits at the end is a decimal comma
  // (then dots group thousands, "1.250,50"); otherwise commas group them.
  const normalized = /,\d{1,2}$/.test(compact)
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}
