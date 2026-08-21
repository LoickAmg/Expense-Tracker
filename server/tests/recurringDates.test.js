import { describe, it, expect } from "vitest";
import { computeMonthlyOccurrences, computeWeeklyOccurrences, computeOccurrences } from "../src/lib/recurringDates.js";

describe("computeMonthlyOccurrences", () => {
  it("génère une occurrence par mois au bon jour", () => {
    const occurrences = computeMonthlyOccurrences({
      startDate: "2026-01-01",
      dayOfPeriod: 1,
      untilDate: "2026-04-01",
    });
    expect(occurrences).toEqual(["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]);
  });

  it("plafonne le jour aux mois plus courts (31 → dernier jour de février)", () => {
    const occurrences = computeMonthlyOccurrences({
      startDate: "2026-01-31",
      dayOfPeriod: 31,
      untilDate: "2026-03-31",
    });
    // 2026 n'est pas bissextile → février s'arrête au 28.
    expect(occurrences).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("gère l'année bissextile pour le 29 février", () => {
    const occurrences = computeMonthlyOccurrences({
      startDate: "2028-01-29",
      dayOfPeriod: 29,
      untilDate: "2028-03-29",
    });
    expect(occurrences).toEqual(["2028-01-29", "2028-02-29", "2028-03-29"]);
  });

  it("n'inclut rien avant la date de départ", () => {
    const occurrences = computeMonthlyOccurrences({
      startDate: "2026-08-21",
      dayOfPeriod: 1,
      untilDate: "2026-08-31",
    });
    // Le 1er août est avant le 21 (date de départ) → pas d'occurrence ce mois-ci.
    expect(occurrences).toEqual([]);
  });

  it("n'inclut rien après la date de fin", () => {
    const occurrences = computeMonthlyOccurrences({
      startDate: "2026-01-01",
      dayOfPeriod: 1,
      untilDate: "2026-01-15",
    });
    expect(occurrences).toEqual(["2026-01-01"]);
  });

  it("reprend après la dernière date générée sans dupliquer", () => {
    const occurrences = computeMonthlyOccurrences({
      startDate: "2026-01-01",
      dayOfPeriod: 1,
      untilDate: "2026-04-01",
      afterDate: "2026-02-01",
    });
    expect(occurrences).toEqual(["2026-03-01", "2026-04-01"]);
  });

  it("ne génère rien si la reprise est déjà à jour", () => {
    const occurrences = computeMonthlyOccurrences({
      startDate: "2026-01-01",
      dayOfPeriod: 1,
      untilDate: "2026-02-01",
      afterDate: "2026-02-01",
    });
    expect(occurrences).toEqual([]);
  });
});

describe("computeWeeklyOccurrences", () => {
  it("génère une occurrence par semaine au bon jour de semaine", () => {
    // 2026-08-21 est un vendredi (5).
    const occurrences = computeWeeklyOccurrences({
      startDate: "2026-08-21",
      dayOfPeriod: 5,
      untilDate: "2026-09-11",
    });
    expect(occurrences).toEqual(["2026-08-21", "2026-08-28", "2026-09-04", "2026-09-11"]);
  });

  it("cherche le premier jour correspondant si startDate ne tombe pas sur le bon jour", () => {
    // 2026-08-21 est un vendredi ; on veut le lundi (1) suivant.
    const occurrences = computeWeeklyOccurrences({
      startDate: "2026-08-21",
      dayOfPeriod: 1,
      untilDate: "2026-08-25",
    });
    expect(occurrences).toEqual(["2026-08-24"]);
  });

  it("reprend après la dernière date générée par sauts de 7 jours", () => {
    const occurrences = computeWeeklyOccurrences({
      startDate: "2026-08-21",
      dayOfPeriod: 5,
      untilDate: "2026-09-11",
      afterDate: "2026-08-28",
    });
    expect(occurrences).toEqual(["2026-09-04", "2026-09-11"]);
  });
});

describe("computeOccurrences", () => {
  it("délègue vers la fonction mensuelle ou hebdomadaire selon frequency", () => {
    const monthly = computeOccurrences(
      { frequency: "monthly", startDate: "2026-01-01", dayOfPeriod: 1, lastGeneratedDate: null },
      "2026-02-01",
    );
    expect(monthly).toEqual(["2026-01-01", "2026-02-01"]);

    const weekly = computeOccurrences(
      { frequency: "weekly", startDate: "2026-08-21", dayOfPeriod: 5, lastGeneratedDate: null },
      "2026-08-21",
    );
    expect(weekly).toEqual(["2026-08-21"]);
  });
});
