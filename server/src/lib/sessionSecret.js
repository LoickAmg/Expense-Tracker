const DEV_FALLBACK = "dev-secret-change-me";
const KNOWN_PLACEHOLDERS = new Set([DEV_FALLBACK, "change-me"]);
const MIN_PRODUCTION_LENGTH = 32;

/**
 * Secret de signature du cookie de session. En production, une valeur
 * absente, connue (exemple du .env.example) ou trop courte fait échouer le
 * démarrage : sinon n'importe qui pourrait forger un cookie de session.
 */
export function resolveSessionSecret(env = process.env) {
  const secret = env.SESSION_SECRET?.trim();

  if (env.NODE_ENV === "production") {
    if (!secret || KNOWN_PLACEHOLDERS.has(secret) || secret.length < MIN_PRODUCTION_LENGTH) {
      throw new Error(
        `SESSION_SECRET doit être défini en production (${MIN_PRODUCTION_LENGTH} caractères minimum, valeur aléatoire).`,
      );
    }
  }

  return secret || DEV_FALLBACK;
}
