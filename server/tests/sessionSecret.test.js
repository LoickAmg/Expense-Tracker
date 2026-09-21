import { describe, expect, it } from "vitest";
import { resolveSessionSecret } from "../src/lib/sessionSecret.js";

const STRONG = "a".repeat(48);

describe("resolveSessionSecret", () => {
  it("accepte un secret solide en production", () => {
    expect(resolveSessionSecret({ NODE_ENV: "production", SESSION_SECRET: STRONG })).toBe(STRONG);
  });

  it("refuse de démarrer en production sans secret", () => {
    expect(() => resolveSessionSecret({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
    expect(() => resolveSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "  " })).toThrow(/SESSION_SECRET/);
  });

  it("refuse les valeurs d'exemple et les secrets trop courts en production", () => {
    for (const weak of ["change-me", "dev-secret-change-me", "trop-court"]) {
      expect(() => resolveSessionSecret({ NODE_ENV: "production", SESSION_SECRET: weak })).toThrow(/SESSION_SECRET/);
    }
  });

  it("garde un repli de développement hors production", () => {
    expect(resolveSessionSecret({ NODE_ENV: "development" })).toBe("dev-secret-change-me");
    expect(resolveSessionSecret({ NODE_ENV: "test", SESSION_SECRET: "test-secret" })).toBe("test-secret");
  });
});
