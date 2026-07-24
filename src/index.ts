import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { requireAuth } from "./middleware/auth";
import { authRoutes } from "./routes/auth.tsx";
import { dashboardRoutes } from "./routes/dashboard.tsx";
import { journalRoutes } from "./routes/journal.tsx";
import { scheduleRoutes } from "./routes/schedule.tsx";
import { studentsRoutes } from "./routes/students.tsx";

const app = new Hono();

app.use("/static/*", serveStatic({ root: "./src" }));
app.use("/vendor/*", serveStatic({ root: "./public" }));
app.use("/templates/*", serveStatic({ root: "./" }));

app.get("/", (c) => c.redirect("/app"));

app.route("/", authRoutes);

app.use("/app/*", requireAuth);
app.route("/", dashboardRoutes);
app.route("/", studentsRoutes);
app.route("/", scheduleRoutes);
app.route("/", journalRoutes);

const port = Number(process.env.PORT ?? 3000);

export default {
  port,
  fetch: app.fetch,
};
