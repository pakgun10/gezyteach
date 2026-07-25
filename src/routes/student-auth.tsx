import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Alert } from "../components/Alert";
import { ThemeInitScript, ThemeToggle } from "../components/ThemeToggle";
import { STUDENT_SESSION_COOKIE } from "../middleware/student-auth";
import {
  createStudentSession,
  destroyStudentSession,
  verifyStudentCredentials,
} from "../services/student-auth.service";

export const studentAuthRoutes = new Hono();

function StudentLoginPage({
  loginId,
  error,
}: {
  loginId?: string;
  error?: boolean;
}) {
  return (
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Masuk Siswa · GezyTeach</title>
        <ThemeInitScript />
        <link rel="stylesheet" href="/static/style.css" />
      </head>
      <body class="gt-transition min-h-screen flex items-center justify-center px-4 relative">
        <div class="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div class="gt-card w-full max-w-sm shadow-sm p-6">
          <h1 class="gt-accent-text text-xl font-semibold mb-1">
            GezyTeach Siswa
          </h1>
          <p class="gt-muted text-sm mb-6">
            Masuk dengan NIS dan PIN yang diberikan guru
          </p>

          {error && (
            <Alert variant="error">
              NIS atau PIN salah, atau akun belum diaktifkan.
            </Alert>
          )}

          <form method="post" action="/siswa/login">
            <label class="block mb-4">
              <span class="gt-label">NIS</span>
              <input
                type="text"
                name="loginId"
                inputmode="numeric"
                value={loginId}
                required
                autofocus
                class="gt-input"
              />
            </label>
            <label class="block mb-4">
              <span class="gt-label">PIN</span>
              <input
                type="password"
                name="pin"
                inputmode="numeric"
                required
                class="gt-input"
              />
            </label>
            <button
              type="submit"
              class="gt-btn-primary w-full py-2.5 transition"
            >
              Masuk
            </button>
          </form>
        </div>
      </body>
    </html>
  );
}

studentAuthRoutes.get("/siswa/login", (c) => {
  return c.html(<StudentLoginPage />);
});

studentAuthRoutes.post("/siswa/login", async (c) => {
  const body = await c.req.parseBody();
  const loginId = String(body.loginId ?? "").trim();
  const pin = String(body.pin ?? "");

  const student = await verifyStudentCredentials(loginId, pin);

  if (!student) {
    return c.html(<StudentLoginPage loginId={loginId} error />, 401);
  }

  const session = await createStudentSession(student.id);

  setCookie(c, STUDENT_SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });

  return c.redirect("/siswa");
});

studentAuthRoutes.post("/siswa/logout", async (c) => {
  const sessionId = getCookie(c, STUDENT_SESSION_COOKIE);
  await destroyStudentSession(sessionId);
  deleteCookie(c, STUDENT_SESSION_COOKIE, { path: "/" });
  return c.redirect("/siswa/login");
});
