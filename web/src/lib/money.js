const formatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatMoney(amount) {
  return formatter.format(amount ?? 0);
}

export function formatMonthLabel(month) {
  const [year, mm] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mm - 1, 1));
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}
