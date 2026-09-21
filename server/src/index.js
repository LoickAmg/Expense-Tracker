import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieSession from "cookie-session";

import { resolveSessionSecret } from "./lib/sessionSecret.js";

import { authRouter } from "./routes/auth.js";
import { categoriesRouter } from "./routes/categories.js";
import { transactionsRouter } from "./routes/transactions.js";
import { recurringRouter } from "./routes/recurring.js";
import { budgetsRouter } from "./routes/budgets.js";
import { dashboardRouter } from "./routes/dashboard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

export function createApp() {
  const app = express();

  if (isProd) {
    // Render (comme Heroku/Railway) termine le HTTPS au niveau du proxy et
    // transmet la requête en HTTP en interne. Sans ça, Express voit une
    // connexion "non sécurisée" et le module `cookies` (utilisé par
    // cookie-session) refuse silencieusement de poser un cookie marqué
    // `secure: true` — la session ne persiste jamais après le login.
    // (Bug rencontré et corrigé après coup sur Task Manager App — appliqué
    // ici dès le départ.)
    app.set("trust proxy", 1);
  }

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan(isProd ? "combined" : "dev"));
  }
  app.use(express.json());

  if (!isProd) {
    app.use(cors({ origin: "http://localhost:5173", credentials: true }));
  }

  app.use(
    cookieSession({
      name: "session",
      secret: resolveSessionSecret(),
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
    }),
  );

  app.use("/api/auth", authRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/recurring", recurringRouter);
  app.use("/api/budgets", budgetsRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  if (isProd) {
    const staticDir = path.join(__dirname, "..", "public");
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status < 500 ? err.message : "Erreur serveur." });
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`API démarrée sur http://localhost:${port}`);
  });
}
