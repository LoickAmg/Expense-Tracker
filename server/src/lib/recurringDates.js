// Calcul pur des dates d'occurrence d'une règle récurrente — aucune
// dépendance à la BDD ni à l'horloge système ici, ce qui le rend facile à
// tester unitairement avec des dates fixes.
//
// Les dates sont manipulées comme des chaînes ISO "YYYY-MM-DD" : ce format
// à largeur fixe se compare directement avec les opérateurs < <= > >=, donc
// pas besoin de reconvertir en objets Date pour ordonner deux occurrences.

function daysInMonth(year, monthIndex) {
  // Jour 0 du mois suivant = dernier jour du mois demandé.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function parseISO(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month: month - 1, day };
}

function toISO(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function addDaysISO(dateStr, days) {
  const { year, month, day } = parseISO(dateStr);
  const d = new Date(Date.UTC(year, month, day + days));
  return toISO(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function weekdayOf(dateStr) {
  const { year, month, day } = parseISO(dateStr);
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

/**
 * Occurrences mensuelles au jour `dayOfPeriod` (1-31, plafonné à la
 * longueur réelle du mois) entre `startDate` et `untilDate` inclus.
 * Si `afterDate` est fourni, seules les occurrences strictement
 * postérieures sont renvoyées (reprise après la dernière génération).
 */
export function computeMonthlyOccurrences({ startDate, dayOfPeriod, untilDate, afterDate }) {
  const start = parseISO(startDate);
  const occurrences = [];

  let { year, month } = start;
  // Si on reprend après une date déjà générée, on repart du mois suivant
  // cette date plutôt que du mois de départ de la règle.
  if (afterDate && afterDate >= startDate) {
    const after = parseISO(afterDate);
    year = after.year;
    month = after.month + 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  // Garde-fou : jamais plus de 1200 itérations (100 ans) même si les dates
  // fournies sont aberrantes.
  for (let i = 0; i < 1200; i++) {
    const day = Math.min(dayOfPeriod, daysInMonth(year, month));
    const candidate = toISO(year, month, day);

    if (candidate > untilDate) break;
    if (candidate >= startDate && (!afterDate || candidate > afterDate)) {
      occurrences.push(candidate);
    }

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return occurrences;
}

/**
 * Occurrences hebdomadaires au jour de semaine `dayOfPeriod` (0=dimanche
 * ... 6=samedi) entre `startDate` et `untilDate` inclus.
 */
export function computeWeeklyOccurrences({ startDate, dayOfPeriod, untilDate, afterDate }) {
  const occurrences = [];

  // Premier jour >= startDate qui tombe sur le bon jour de semaine.
  let cursor = startDate;
  while (weekdayOf(cursor) !== dayOfPeriod) {
    cursor = addDaysISO(cursor, 1);
  }

  if (afterDate && afterDate >= cursor) {
    // Avance par sauts de 7 jours jusqu'à dépasser afterDate.
    while (cursor <= afterDate) {
      cursor = addDaysISO(cursor, 7);
    }
  }

  for (let i = 0; i < 5200; i++) {
    // ~100 ans de garde-fou
    if (cursor > untilDate) break;
    occurrences.push(cursor);
    cursor = addDaysISO(cursor, 7);
  }

  return occurrences;
}

export function computeOccurrences(rule, untilDate) {
  const params = {
    startDate: rule.startDate,
    dayOfPeriod: rule.dayOfPeriod,
    untilDate,
    afterDate: rule.lastGeneratedDate,
  };
  return rule.frequency === "weekly" ? computeWeeklyOccurrences(params) : computeMonthlyOccurrences(params);
}
