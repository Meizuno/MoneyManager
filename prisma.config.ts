import { defineConfig } from "prisma/config";

export default defineConfig({
  datasourceUrl: process.env.NUXT_DATABASE_URL,
});
