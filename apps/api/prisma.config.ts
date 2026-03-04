import { defineConfig, env } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "src/shared/db/",
  migrations: {
    path: "src/shared/db/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
