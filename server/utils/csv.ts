import type { CsvRow, CsvTransactionRow } from "~/types/csv";

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

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
      "datum zaúčtování",
    ],
  },
  {
    key: "name",
    names: [
      "description",
      "name",
      "název obchodníka",
      "poznámka",
      "vlastní poznámka",
    ],
  },
  {
    key: "amount",
    names: [
      "amount",
      "zaúčtovaná částka",
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
    const exactIndex = matcher.names.findIndex(
      (name) => value === normalize(name),
    );
    if (exactIndex !== -1) {
      return { key: matcher.key, priority: matcher.names.length - exactIndex };
    }
    const includesIndex = matcher.names.findIndex((name) =>
      value.includes(normalize(name)),
    );
    if (includesIndex !== -1) {
      return {
        key: matcher.key,
        priority: matcher.names.length - includesIndex,
      };
    }
  }
  return null;
};

export const mapCsvRows = (rows: CsvRow[]) => {
  if (rows.length === 0) {
    return { mapped: [], skipped: rows.length, skippedRows: [] as CsvRow[] };
  }

  const headers = rows[0].map(matchHeader);
  const mapped: CsvTransactionRow[] = [];
  const skippedRows: Array<{
    rowIndex: number;
    row: CsvRow;
    rowText: string;
    reason: string;
  }> = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.every((value) => value.trim().length === 0)) {
      continue;
    }
    const rowData: Record<string, string> = {};
    const rowPriority: Record<string, number> = {};
    for (let j = 0; j < headers.length; j += 1) {
      const header = headers[j];
      if (!header) continue;
      const { key, priority } = header;
      const value = row[j] ?? "";
      const hasValue = value.trim().length > 0;
      const currentPriority = rowPriority[key] ?? 0;
      if (!hasValue && rowData[key]) {
        continue;
      }
      if (!rowData[key] || priority > currentPriority) {
        rowData[key] = value;
        rowPriority[key] = priority;
      }
    }

    let amount = parseAmount(rowData.amount, rowData.debit, rowData.credit);
    let parsedDate = rowData.date ? parseDateToISO(rowData.date) : null;
    if ((!parsedDate || amount === null) && row.length > 6) {
      const fallbackDate = parseDateToISO(row[0] ?? "");
      const fallbackAmount = parseAmount(row[row.length - 4] ?? "");
      if (fallbackDate && fallbackAmount !== null) {
        parsedDate = fallbackDate;
        amount = fallbackAmount;
        rowData.name = row.slice(1, row.length - 4).join(",").trim();
        rowData.currency = row[row.length - 3] ?? "";
        rowData.type = row[row.length - 2] ?? "";
        rowData.category = row[row.length - 1] ?? "";
      }
    }
    if (!parsedDate || amount === null) {
      const reason = !parsedDate && amount === null
        ? "invalid date and amount"
        : !parsedDate
          ? "invalid date"
          : "invalid amount";
      skippedRows.push({
        rowIndex: i + 1,
        row,
        rowText: row.join(","),
        reason,
      });
      continue;
    }

    mapped.push({
      date: parsedDate,
      name: rowData.name?.trim() || "Transaction",
      amount,
      currency: rowData.currency ? rowData.currency.trim() : null,
      type: rowData.type ? rowData.type.trim() : null,
      category: rowData.category ? rowData.category.trim() : null,
    });
  }

  return { mapped, skipped: rows.length - 1 - mapped.length, skippedRows };
};

const parseDateToISO = (value: string) => {
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const isoMatch = raw.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const hour = isoMatch[4] ? Number(isoMatch[4]) : 0;
    const minute = isoMatch[5] ? Number(isoMatch[5]) : 0;
    const second = isoMatch[6] ? Number(isoMatch[6]) : 0;
    return toISODateTime(year, month, day, hour, minute, second);
  }

  const dmyMatch = raw.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const hour = dmyMatch[4] ? Number(dmyMatch[4]) : 0;
    const minute = dmyMatch[5] ? Number(dmyMatch[5]) : 0;
    const second = dmyMatch[6] ? Number(dmyMatch[6]) : 0;
    return toISODateTime(year, month, day, hour, minute, second);
  }

  return null;
};

const toISODateTime = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
) => {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }
  return date.toISOString();
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
