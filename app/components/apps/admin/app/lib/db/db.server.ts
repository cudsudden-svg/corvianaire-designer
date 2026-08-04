// Prisma client singleton.
//
// In dev, Remix's Vite server hot-reloads modules on every file change.
// Without the global-caching trick below, that would spin up a brand new
// PrismaClient (and a brand new DB connection pool) on every single edit,
// eventually exhausting SQLite/Postgres connections. Caching it on
// `globalThis` survives hot reloads while still giving a fresh instance
// per real process restart.
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export default prisma;
