import { createError } from "h3";
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export const getPrisma = () => {
  if (!prisma) {
    const datasourceUrl = process.env.NUXT_DATABASE_URL;
    if (!datasourceUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: "NUXT_DATABASE_URL is not configured.",
      });
    }
    prisma = new PrismaClient({ datasourceUrl });
  }
  return prisma;
};
