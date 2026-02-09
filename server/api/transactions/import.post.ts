import { getHeader, readBody, readFormData } from "h3";

export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, "content-type") ?? "";
  let csv = "";
  let defaultCategory = "other";
  let defaultType = "other";

  if (contentType.includes("multipart/form-data")) {
    const formData = await readFormData(event);
    const file = formData.get("file");
    const category = formData.get("defaultCategory");
    const transactionType = formData.get("defaultType");
    if (typeof category === "string") {
      defaultCategory = normalizeCategory(category);
    }
    if (typeof transactionType === "string") {
      defaultType = normalizeTransactionType(transactionType);
    }

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
    if (typeof body?.defaultCategory === "string") {
      defaultCategory = normalizeCategory(body.defaultCategory);
    }
    if (typeof body?.defaultType === "string") {
      defaultType = normalizeTransactionType(body.defaultType);
    }
  }

  if (!csv.trim()) {
    return {
      imported: 0,
      skipped: 0,
      message: "No CSV data provided.",
    };
  }

  const rows = parseCsv(csv);
  const { mapped, skipped } = mapCsvRows(rows);

  const session = await getUserSession(event);
  if (!session.user) {
    const items: Transaction[] = mapped.map((row, index) => ({
      id: -1 * (index + 1),
      date: row.date,
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      type: normalizeTransactionType(row.type ?? defaultType),
      category: normalizeCategory(row.category ?? defaultCategory),
    }));
    return {
      imported: mapped.length,
      skipped,
      persisted: false,
      items,
    };
  }

  const db = getDb(event);

  if (mapped.length === 0) {
    return {
      imported: 0,
      skipped,
      message: "No valid rows found in CSV.",
    };
  }

  const statement = db.prepare(
    "INSERT INTO transactions (date, description, amount, currency, type, category) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const statements = mapped.map((row) =>
    statement.bind(
      row.date,
      row.description,
      row.amount,
      row.currency,
      normalizeTransactionType(row.type ?? defaultType),
      normalizeCategory(row.category ?? defaultCategory),
    ),
  );

  await db.batch(statements);

  return {
    imported: mapped.length,
    skipped,
    persisted: true,
  };
});
