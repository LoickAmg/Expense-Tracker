// Crée le compte admin (mono-utilisateur) et quelques catégories/données de
// démo s'ils n'existent pas déjà. Idempotent : peut être relancé sans
// dupliquer les données.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./client.js";
import { users, categories, transactions, budgets, recurringTransactions } from "./schema.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function main() {
  const email = process.env.SEED_USER_EMAIL || "admin@example.com";
  const password = process.env.SEED_USER_PASSWORD || "changeme123";
  const name = process.env.SEED_USER_NAME || "Admin";

  let [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    [user] = await db.insert(users).values({ email, passwordHash, name }).returning();
    console.log(`Utilisateur créé : ${email}`);
  } else {
    console.log(`Utilisateur déjà présent : ${email}`);
  }

  const existingCategories = await db.select().from(categories).where(eq(categories.userId, user.id));

  if (existingCategories.length === 0) {
    const [salaire, alimentation, logement, transport, loisirs] = await db
      .insert(categories)
      .values([
        { name: "Salaire", type: "income", color: "#63e6be", userId: user.id },
        { name: "Alimentation", type: "expense", color: "#ffa94d", userId: user.id },
        { name: "Logement", type: "expense", color: "#ff6b6b", userId: user.id },
        { name: "Transport", type: "expense", color: "#6ea8fe", userId: user.id },
        { name: "Loisirs", type: "expense", color: "#da77f2", userId: user.id },
      ])
      .returning();

    await db.insert(transactions).values([
      { amountCents: 250000, date: todayISO(), note: "Paie du mois", userId: user.id, categoryId: salaire.id },
      { amountCents: 4500, date: todayISO(), note: "Courses", userId: user.id, categoryId: alimentation.id },
      { amountCents: 1200, date: todayISO(), note: "Ticket de métro", userId: user.id, categoryId: transport.id },
      { amountCents: 2500, date: todayISO(), note: "Cinéma", userId: user.id, categoryId: loisirs.id },
    ]);

    await db.insert(budgets).values([
      { month: currentMonth(), amountCents: 40000, userId: user.id, categoryId: alimentation.id },
      { month: currentMonth(), amountCents: 10000, userId: user.id, categoryId: transport.id },
    ]);

    await db.insert(recurringTransactions).values({
      amountCents: 80000,
      note: "Loyer",
      frequency: "monthly",
      dayOfPeriod: 1,
      startDate: todayISO(),
      userId: user.id,
      categoryId: logement.id,
    });

    console.log("Catégories, transactions, budgets et récurrence de démo créés.");
  } else {
    console.log("Données de démo déjà présentes, rien à faire.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Échec du seed :", err);
  process.exit(1);
});
