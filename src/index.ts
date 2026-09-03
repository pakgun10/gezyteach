import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { requireAdmin, requireAuth } from "./middleware/auth";
import { requireStudentAuth } from "./middleware/student-auth";
import { adminRoutes } from "./routes/admin.tsx";
import { attendanceRoutes } from "./routes/attendance.tsx";
import { attendanceRecapRoutes } from "./routes/attendance-recap.tsx";
import { authRoutes } from "./routes/auth.tsx";
import { dashboardRoutes } from "./routes/dashboard.tsx";
import { journalRoutes } from "./routes/journal.tsx";
import { journalReportRoutes } from "./routes/journal-report.tsx";
import { anecdotalRoutes } from "./routes/anecdotal.tsx";
import { profileRoutes } from "./routes/profile.tsx";
import { resourcesRoutes } from "./routes/resources.tsx";
import { scheduleRoutes } from "./routes/schedule.tsx";
import { schoolRoutes } from "./routes/school.tsx";
import { scoresRoutes } from "./routes/scores.tsx";
import { studentAuthRoutes } from "./routes/student-auth.tsx";
import { studentPortalRoutes } from "./routes/student-portal.tsx";
import { studentsRoutes } from "./routes/students.tsx";

const app = new Hono();

app.use("/static/*", serveStatic({ root: "./src" }));
app.use("/vendor/*", serveStatic({ root: "./public" }));
app.use("/templates/*", serveStatic({ root: "./" }));

app.get("/", (c) => c.redirect("/app"));

app.route("/", authRoutes);

app.use("/app/*", requireAuth);
app.use("/api/*", requireAuth);
app.use("/app/admin/*", requireAdmin);
app.use("/app/students", requireAdmin);
app.use("/app/students/*", requireAdmin);
app.route("/", dashboardRoutes);
app.route("/", studentsRoutes);
app.route("/", scheduleRoutes);
// Harus dipasang sebelum journalRoutes: route jurnal lama memiliki pola
// `/app/journal/:id`, yang jika lebih dulu akan menganggap "anecdotal" sebagai id.
app.route("/", anecdotalRoutes);
app.route("/", journalRoutes);
app.route("/", journalReportRoutes);
app.route("/", attendanceRoutes);
app.route("/", attendanceRecapRoutes);
app.route("/", scoresRoutes);
app.route("/", resourcesRoutes);
app.route("/", profileRoutes);
app.route("/", adminRoutes);
app.route("/", schoolRoutes);

app.route("/", studentAuthRoutes);

app.use("/siswa", requireStudentAuth);
app.use("/siswa/absensi", requireStudentAuth);
app.use("/siswa/nilai", requireStudentAuth);
app.use("/siswa/profil", requireStudentAuth);
app.use("/siswa/profil/*", requireStudentAuth);
app.route("/", studentPortalRoutes);

const port = Number(process.env.PORT ?? 3000);

export default {
  port,
  fetch: app.fetch,
};
