import { describe, it, expect } from "vitest";
import { formatMoney, formatMonthLabel } from "@/lib/money.js";

describe("formatMoney", () => {
  it("formate un montant en euros avec le format français", () => {
    expect(formatMoney(1234.5)).toContain("234,50");
    expect(formatMoney(1234.5)).toContain("€");
  });

  it("gère les valeurs nulles/undefined comme 0", () => {
    expect(formatMoney(null)).toContain("0,00");
    expect(formatMoney(undefined)).toContain("0,00");
  });

  it("gère les montants négatifs", () => {
    expect(formatMoney(-50)).toContain("50,00");
  });
});

describe("formatMonthLabel", () => {
  it("formate 'YYYY-MM' en libellé français long", () => {
    const label = formatMonthLabel("2026-01");
    expect(label.toLowerCase()).toContain("janvier");
    expect(label).toContain("2026");
  });

  it("ne décale pas de mois à cause du fuseau horaire", () => {
    // Piège classique : parser "2026-03-01" en local (UTC-x) peut faire
    // basculer au 28 février. On force UTC pour l'affichage.
    expect(formatMonthLabel("2026-03").toLowerCase()).toContain("mars");
    expect(formatMonthLabel("2026-12").toLowerCase()).toContain("décembre");
  });
});
