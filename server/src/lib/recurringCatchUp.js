import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { recurringTransactions, transactions } from "../db/schema.js";
import { computeOccurrences } from "./recurringDates.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Génère les transactions manquantes pour toutes les règles récurrentes
// actives d'un utilisateur, jusqu'à aujourd'hui inclus. Appelé au début des
// endpoints de lecture (transactions, dashboard) plutôt que via un job
// planifié externe — pas besoin de worker séparé, et ça reste correct même
// si le service Render s'est mis en veille pendant plusieurs jours.
export async function runRecurringCatchUp(userId, until = todayISO()) {
  const rules = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.active, true)));

  let created = 0;

  for (const rule of rules) {
    const occurrences = computeOccurrences(rule, until);
    if (!occurrences.length) continue;

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values(
        occurrences.map((date) => ({
          amountCents: rule.amountCents,
          note: rule.note,
          date,
          userId,
          categoryId: rule.categoryId,
          recurringId: rule.id,
        })),
      );

      await tx
        .update(recurringTransactions)
        .set({ lastGeneratedDate: occurrences[occurrences.length - 1] })
        .where(eq(recurringTransactions.id, rule.id));
    });

    created += occurrences.length;
  }

  return created;
}
