import { getHeader, readBody, readFormData } from "h3";
import { mapCsvRows, parseCsv } from "../../utils/csv";
import { normalizeTransactionType } from "../../utils/transactions";

const escapeCsvValue = (value: string | number | null) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildCsv = (rows: Array<Record<string, string | number | null>>) => {
  const headers = ["date", "name", "amount", "currency", "type", "category"];
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    const line = headers.map((key) => escapeCsvValue(row[key] ?? "")).join(",");
    lines.push(line);
  });
  return lines.join("\n");
};

export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, "content-type") ?? "";
  let csv = "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await readFormData(event);
    const file = formData.get("file");

    if (file instanceof File) {
      csv = await file.text();
    } else if (typeof file === "string") {
      csv = file;
    }
  } else {
    const body = await readBody(event);
    if (typeof body?.csv === "string") {
      csv = body.csv;
    }
  }

  if (!csv.trim()) {
    return {
      converted: 0,
      skipped: 0,
      items: [],
      csv: "",
    };
  }

  const { mapped, skipped } = mapCsvRows(parseCsv(csv));
  const rows = mapped.map((row) => ({
    date: row.date,
    name: row.name,
    amount: row.amount,
    currency: row.currency,
    type: normalizeTransactionType(row.amount),
    category: "other",
  }));

  return {
    converted: rows.length,
    skipped,
    items: rows,
    csv: buildCsv(rows),
  };
});
