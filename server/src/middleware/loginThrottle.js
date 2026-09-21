/**
 * Freine le brute-force du mot de passe : après `maxFailures` connexions
 * refusées (401) depuis une même IP, les tentatives suivantes reçoivent 429
 * jusqu'à la fin de la fenêtre. Une connexion réussie remet le compteur à
 * zéro. État en mémoire du process : ne survit pas à un redémarrage et n'est
 * pas partagé entre plusieurs instances.
 */
export function createLoginThrottle({ windowMs = 15 * 60 * 1000, maxFailures = 10, now = Date.now } = {}) {
  const failures = new Map();

  function sweep(at) {
    for (const [key, entry] of failures) {
      if (entry.resetAt <= at) failures.delete(key);
    }
  }

  return function loginThrottle(req, res, next) {
    const key = req.ip ?? "unknown";
    const entry = failures.get(key);
    const at = now();

    if (entry && entry.resetAt > at && entry.count >= maxFailures) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - at) / 1000)));
      res.status(429).json({ error: "Trop de tentatives de connexion. Réessaie plus tard." });
      return;
    }

    res.on("finish", () => {
      const finishedAt = now();
      if (res.statusCode === 401) {
        const current = failures.get(key);
        if (!current || current.resetAt <= finishedAt) {
          sweep(finishedAt);
          failures.set(key, { count: 1, resetAt: finishedAt + windowMs });
        } else {
          current.count += 1;
        }
      } else if (res.statusCode < 400) {
        failures.delete(key);
      }
    });

    next();
  };
}
