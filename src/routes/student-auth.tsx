import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Alert } from "../components/Alert";
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
        <link rel="stylesheet" href="/static/style.css" />
      </head>
      <body class="bg-slate-50 text-slate-900 min-h-screen flex items-center justify-center px-4">
        <div class="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h1 class="text-xl font-semibold text-emerald-700 mb-1">
            GezyTeach Siswa
          </h1>
          <p class="text-sm text-slate-500 mb-6">
            Masuk dengan NIS dan PIN yang diberikan guru
          </p>

          {error && (
            <Alert variant="error">NIS atau PIN salah, atau akun belum diaktifkan.</Alert>
          )}

          <form method="post" action="/siswa/login">
            <label class="block mb-4">
              <span class="block text-sm font-medium text-slate-700 mb-1">
                NIS
              </span>
              <input
                type="text"
                name="loginId"
                inputmode="numeric"
                value={loginId}
                required
                autofocus
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </label>
            <label class="block mb-4">
              <span class="block text-sm font-medium text-slate-700 mb-1">
                PIN
              </span>
              <input
                type="password"
                name="pin"
                inputmode="numeric"
                required
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </label>
            <button
              type="submit"
              class="w-full bg-emerald-600 text-white rounded-lg py-2.5 font-medium hover:bg-emerald-700 transition"
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
