import { beforeAll, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/db/client.js";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
});

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      budgets, recurring_transactions, transactions, categories, users
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await pool.end();
});
