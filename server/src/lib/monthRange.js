// "2026-03" -> { start: "2026-03-01", end: "2026-04-01" } (borne de fin
// exclusive, pratique pour un filtre `date >= start AND date < end` qui
// gère les mois de longueur différente sans calcul de dernier jour).
export function monthRange(month) {
  const [year, mm] = month.split("-").map(Number);
  const start = `${month}-01`;
  const endMonth = mm === 12 ? 1 : mm + 1;
  const endYear = mm === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return { start, end };
}

export function isValidMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month, delta) {
  const [year, mm] = month.split("-").map(Number);
  const total = year * 12 + (mm - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}
