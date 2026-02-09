import { createError, getHeader, readBody, readFormData } from "h3";

type ImportRow = {
  date: string;
  name: string;
  amount: number;
  currency: string | null;
  type: string | null;
  category: string | null;
};

const parseAmount = (value: string) => {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
};

const parseDateValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const parseNormalizedCsv = (csv: string) => {
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return { mapped: [] as ImportRow[], skipped: 0, skippedRows: [] as any[] };
  }

  const headerIndex = new Map<string, number>();
  rows[0].forEach((header: string, index: number) => {
    if (!headerIndex.has(header)) {
      headerIndex.set(header, index);
    }
  });

  const required = ["date", "name", "amount"];
  const missing = required.filter((key) => !headerIndex.has(key));
  if (missing.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Missing required columns: ${missing.join(", ")}.`,
    });
  }

  const mapped: ImportRow[] = [];
  const skippedRows: Array<{
    rowIndex: number;
    row: CsvRow;
    rowText: string;
    reason: string;
  }> = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    if (index) {
      mapped.push({
        date: parseDateValue(row[0]) || "",
        name: row[1].trim(),
        amount: parseAmount(row[2]) || 0,
        currency: row[3],
        type: row[4],
        category: row[5],
      });
    }
  });

  return { mapped, skipped, skippedRows };
};

const parseNormalizedJson = (json: string) => {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid JSON payload.",
    });
  }

  const items = Array.isArray(data)
    ? data
    : typeof data === "object" &&
        data !== null &&
        Array.isArray((data as any).items)
      ? (data as any).items
      : null;

  if (!items) {
    throw createError({
      statusCode: 400,
      statusMessage: "JSON must be an array of transactions.",
    });
  }

  const mapped: ImportRow[] = [];
  const skippedRows: Array<{ index: number; item: unknown; reason: string }> =
    [];
  let skipped = 0;

  items.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      skipped += 1;
      skippedRows.push({ index, item, reason: "invalid item" });
      return;
    }
    const raw = item as Record<string, unknown>;
    const date = typeof raw.date === "string" ? parseDateValue(raw.date) : null;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const amount =
      typeof raw.amount === "number"
        ? raw.amount
        : typeof raw.amount === "string"
          ? parseAmount(raw.amount)
          : null;

    if (!date || !name || amount === null) {
      skipped += 1;
      skippedRows.push({ index, item, reason: "missing required fields" });
      return;
    }

    mapped.push({
      date,
      name,
      amount,
      currency:
        typeof raw.currency === "string" && raw.currency.trim().length > 0
          ? raw.currency.trim()
          : null,
      type:
        typeof raw.type === "string" && raw.type.trim().length > 0
          ? raw.type.trim()
          : null,
      category:
        typeof raw.category === "string" && raw.category.trim().length > 0
          ? raw.category.trim()
          : null,
    });
  });

  return { mapped, skipped, skippedRows };
};

export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, "content-type") ?? "";
  let csv = "";
  let json = "";
  let format: "csv" | "json" | null = null;
  if (contentType.includes("multipart/form-data")) {
    const formData = await readFormData(event);
    const file = formData.get("file");
    const formFormat = formData.get("format");
    if (typeof formFormat === "string") {
      format = formFormat === "json" ? "json" : "csv";
    }

    if (file instanceof File) {
      if (!format && file.name?.toLowerCase().endsWith(".json")) {
        format = "json";
      }
      const text = await file.text();
      if (format === "json") {
        json = text;
      } else {
        csv = text;
      }
    } else if (typeof file === "string") {
      csv = file;
    }
  } else {
    const body = await readBody(event);
    if (typeof body?.format === "string") {
      format = body.format === "json" ? "json" : "csv";
    }
    if (typeof body?.csv === "string") {
      csv = body.csv;
    }
    if (typeof body?.json === "string") {
      json = body.json;
    }
  }

  if (!format) {
    if (json.trim() && !csv.trim()) {
      format = "json";
    } else {
      format = "csv";
    }
  }

  if (format === "json" && !json.trim()) {
    return {
      imported: 0,
      skipped: 0,
      message: "No JSON data provided.",
    };
  }
  if (format !== "json" && !csv.trim()) {
    return {
      imported: 0,
      skipped: 0,
      message: "No CSV data provided.",
    };
  }

  const { mapped, skipped, skippedRows } =
    format === "json" ? parseNormalizedJson(json) : parseNormalizedCsv(csv);
  if (mapped.length === 0) {
    return {
      imported: 0,
      skipped,
      message: "No valid rows found.",
    };
  }
  if (skipped > 0 && skippedRows?.length) {
    console.warn("[import] skipped rows", {
      skipped,
      skippedRows,
    });
  }

  const user = await getAuthUser(event);
  if (!user) {
    return {
      imported: mapped.length,
      skipped,
      persisted: false,
      items: mapped,
      skippedRows,
    };
  }

  const prisma = getPrisma();
  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email ?? null,
      name: user.name ?? null,
      picture: user.picture ?? null,
    },
    create: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      picture: user.picture ?? null,
    },
  });
  await prisma.transaction.createMany({
    data: mapped.map((row) => ({
      date: new Date(row.date),
      name: row.name,
      amount: row.amount,
      currency: row.currency,
      type: row.type || "other",
      category: normalizeCategory(row.category),
      user_id: user.id,
    })),
  });

  return {
    imported: mapped.length,
    skipped,
    persisted: true,
    skippedRows,
  };
});
