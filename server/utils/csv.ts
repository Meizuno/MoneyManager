import type { CsvRow, CsvTransactionRow } from "~/types/csv";

const normalize = (value: string) => value.trim().toLowerCase();

export const parseCsv = (input: string): CsvRow[] => {
  const rows: CsvRow[] = [];
  let current: string[] = [];
  let buffer = "";
  let inQuotes = false;

  const pushValue = () => {
    current.push(buffer);
    buffer = "";
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        buffer += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === "," || char === ";")) {
      pushValue();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      pushValue();
      if (current.some((value) => value.trim().length > 0)) {
        rows.push(current.map((value) => value.trim()));
      }
      current = [];
      continue;
    }

    buffer += char;
  }

  pushValue();
  if (current.some((value) => value.trim().length > 0)) {
    rows.push(current.map((value) => value.trim()));
  }

  return rows;
};

const headerMatchers = [
  {
    key: "date",
    names: [
      "date",
      "booking date",
      "transaction date",
      "posting date",
      "datum provedení",
      "datum zaúčtování",
    ],
  },
  {
    key: "description",
    names: [
      "description",
      "details",
      "narrative",
      "merchant",
      "name",
      "název obchodníka",
      "název protiúčtu",
      "název účtu",
      "zpráva",
      "poznámka",
      "vlastní poznámka",
    ],
  },
  {
    key: "amount",
    names: [
      "amount",
      "value",
      "total",
      "zaúčtovaná částka",
      "původní částka",
      "poplatky",
    ],
  },
  {
    key: "currency",
    names: ["currency", "ccy", "měna účtu", "původní měna"],
  },
  { key: "debit", names: ["debit", "withdrawal", "outflow", "expense"] },
  { key: "credit", names: ["credit", "deposit", "inflow", "income"] },
  {
    key: "type",
    names: ["transaction type", "kategorie transakce", "typ transakce"],
  },
  {
    key: "category",
    names: ["category", "label", "tag"],
  },
];

const matchHeader = (header: string) => {
  const value = normalize(header);
  for (const matcher of headerMatchers) {
    if (matcher.names.some((name) => value === name)) {
      return matcher.key;
    }
    if (matcher.names.some((name) => value.includes(name))) {
      return matcher.key;
    }
  }
  return null;
};

export const mapCsvRows = (rows: CsvRow[]) => {
  if (rows.length === 0) {
    return { mapped: [], skipped: rows.length };
  }

  const headers = rows[0].map(matchHeader);
  const mapped: CsvTransactionRow[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.every((value) => value.trim().length === 0)) {
      continue;
    }
    const rowData: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) {
      const key = headers[j];
      if (!key) continue;
      const value = row[j] ?? "";
      if (rowData[key] && rowData[key].trim().length > 0) {
        continue;
      }
      if (value.trim().length === 0 && rowData[key]) {
        continue;
      }
      rowData[key] = value;
    }

    const amount = parseAmount(rowData.amount, rowData.debit, rowData.credit);
    if (!rowData.date || !rowData.description || amount === null) {
      continue;
    }

    mapped.push({
      date: rowData.date.trim(),
      description: rowData.description.trim(),
      amount,
      currency: rowData.currency ? rowData.currency.trim() : null,
      type: rowData.type ? rowData.type.trim() : null,
      category: rowData.category ? rowData.category.trim() : null,
    });
  }

  return { mapped, skipped: rows.length - 1 - mapped.length };
};

const parseAmount = (
  amountValue?: string,
  debitValue?: string,
  creditValue?: string,
) => {
  const normalizeNumber = (value: string) => {
    let cleaned = value.trim();
    if (!cleaned) return null;
    let negative = false;
    if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
      negative = true;
      cleaned = cleaned.slice(1, -1);
    }
    cleaned = cleaned.replace(/\s/g, "");
    if (cleaned.includes(",") && cleaned.includes(".")) {
      cleaned = cleaned.replace(/,/g, "");
    } else if (cleaned.includes(",") && !cleaned.includes(".")) {
      cleaned = cleaned.replace(",", ".");
    }
    const valueNumber = Number(cleaned);
    if (!Number.isFinite(valueNumber)) return null;
    return negative ? -valueNumber : valueNumber;
  };

  if (debitValue || creditValue) {
    const debit = debitValue ? normalizeNumber(debitValue) : null;
    const credit = creditValue ? normalizeNumber(creditValue) : null;
    if (credit !== null && debit !== null) {
      return credit - Math.abs(debit);
    }
    if (credit !== null) return Math.abs(credit);
    if (debit !== null) return -Math.abs(debit);
  }

  return amountValue ? normalizeNumber(amountValue) : null;
};
