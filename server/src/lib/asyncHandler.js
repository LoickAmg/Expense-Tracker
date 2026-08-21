// Évite d'écrire un try/catch dans chaque route : toute erreur (ou rejet de
// promesse) est transmise à `next`, capturée par le middleware d'erreurs
// central dans index.js.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Drizzle enveloppe l'erreur Postgres d'origine dans un DrizzleQueryError —
// le vrai code SQLSTATE (ex: "23503" = violation de clé étrangère, "23505"
// = contrainte unique) est sur `err.cause.code`, pas `err.code`.
export function pgErrorCode(err) {
  return err.code ?? err.cause?.code ?? null;
}
