import { getHeader, readBody, readFormData } from "h3";
import { getUserSession } from "#imports";
import { getPrisma } from "../../utils/db";
import { mapCsvRows, parseCsv } from "../../utils/csv";

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
      imported: 0,
      skipped: 0,
      message: "No CSV data provided.",
    };
  }

  const { mapped, skipped } = mapCsvRows(parseCsv(csv));
  if (mapped.length === 0) {
    return {
      imported: 0,
      skipped,
      message: "No valid rows found in CSV.",
    };
  }

  const session = await getUserSession(event);
  if (!session.user) {
    return {
      imported: mapped.length,
      skipped,
      persisted: false,
      items: mapped,
    };
  }

  const prisma = getPrisma();
  await prisma.transaction.createMany({
    data: mapped.map((row) => ({
      date: new Date(row.date),
      name: row.name,
      amount: row.amount,
      currency: row.currency,
      type: row.type ?? "other",
      category: row.category ?? "other",
      user_id: session.user!.id,
    })),
  });

  return {
    imported: mapped.length,
    skipped,
    persisted: true,
  };
});
