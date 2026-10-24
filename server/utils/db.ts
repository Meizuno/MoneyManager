import { createError } from "h3";
import { PrismaPg } from "@prisma/adapter-pg";
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
    // The schema's engineType "client" runs queries through this driver
    // adapter (node-postgres) rather than a Rust engine.
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: datasourceUrl }) });
  }
  return prisma;
};
