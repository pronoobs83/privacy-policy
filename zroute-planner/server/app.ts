import { RouterContextProvider } from "react-router";
import { createRequestHandler } from "@react-router/express";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import express from "express";

import { auth, migrate } from "./auth";
import { syncRouter } from "./sync";
import { sessionContext } from "~/context";

export const app = express();

app.use(async (_req, _res, next) => {
  try {
    await migrate();
    next();
  } catch (e) {
    next(e);
  }
});

// Better Auth must see the raw body, so it is mounted before any JSON parser.
app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use("/api/sync", syncRouter);

app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
    async getLoadContext(req) {
      const context = new RouterContextProvider();
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
      context.set(sessionContext, session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null);
      return context;
    },
  }),
);
