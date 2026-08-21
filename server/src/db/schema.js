// Schéma de données de l'Expense Tracker (Drizzle ORM).
//
// Les montants sont stockés en centimes (entiers) pour éviter tout souci
// d'arrondi en virgule flottante — 12,50 € est stocké comme 1250.

import { pgTable, text, integer, boolean, timestamp, date, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const categoryTypeEnum = pgEnum("category_type", ["income", "expense"]);
export const recurringFrequencyEnum = pgEnum("recurring_frequency", ["weekly", "monthly"]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: id(),
    name: text("name").notNull(),
    type: categoryTypeEnum("type").notNull(),
    color: text("color").notNull().default("#6ea8fe"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("categories_user_name_idx").on(table.userId, table.name)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    amountCents: integer("amount_cents").notNull(), // toujours positif ; le signe vient de category.type
    note: text("note"),
    date: date("date").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),

    // Renseigné quand la transaction a été générée automatiquement par une
    // règle récurrente (voir recurring.js) — permet de savoir d'où elle
    // vient et d'éviter de la regénérer deux fois.
    recurringId: text("recurring_id"),
  },
  (table) => [index("transactions_user_date_idx").on(table.userId, table.date)],
);

export const recurringTransactions = pgTable("recurring_transactions", {
  id: id(),
  amountCents: integer("amount_cents").notNull(),
  note: text("note"),
  frequency: recurringFrequencyEnum("frequency").notNull(),
  // Mensuel : jour du mois (1-31, plafonné aux mois plus courts).
  // Hebdomadaire : jour de la semaine (0 = dimanche ... 6 = samedi).
  dayOfPeriod: integer("day_of_period").notNull(),
  startDate: date("start_date").notNull(),
  active: boolean("active").notNull().default(true),
  // Dernière occurrence générée — le "catch-up" repart de cette date pour
  // savoir ce qui manque, sans avoir besoin d'un job planifié externe.
  lastGeneratedDate: date("last_generated_date"),

  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
});

export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    month: text("month").notNull(), // format "YYYY-MM"
    amountCents: integer("amount_cents").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("budgets_user_category_month_idx").on(table.userId, table.categoryId, table.month)],
);
