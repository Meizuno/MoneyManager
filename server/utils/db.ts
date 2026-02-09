import { createError } from "h3";
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export const getPrisma = () => {
  if (!prisma) {
    if (!process.env.DATABASE_URL) {
      throw createError({
        statusCode: 500,
        statusMessage: "DATABASE_URL is not configured.",
      });
    }
    prisma = new PrismaClient();
  }
  return prisma;
};
