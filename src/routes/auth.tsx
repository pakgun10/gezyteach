import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Alert } from "../components/Alert";
import { FormInput } from "../components/FormInput";
import { Layout } from "../components/Layout";
import { SESSION_COOKIE } from "../middleware/auth";
import {
  createSession,
  destroySession,
  verifyCredentials,
} from "../services/auth.service";

export const authRoutes = new Hono();

authRoutes.get("/login", (c) => {
  return c.html(
    <Layout title="Masuk">
      <div class="gt-card w-full max-w-sm shadow-sm p-6">
        <h1 class="gt-accent-text text-xl font-semibold mb-1">GezyTeach</h1>
        <p class="gt-muted text-sm mb-6">Masuk untuk mengelola kelas Anda</p>
        <form method="post" action="/login">
          <FormInput
            label="Email"
            name="email"
            type="email"
            required
            autofocus
          />
          <FormInput
            label="Password"
            name="password"
            type="password"
            required
          />
          <button type="submit" class="gt-btn-primary w-full py-2.5 transition">
            Masuk
          </button>
        </form>
      </div>
    </Layout>,
  );
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");

  const user = await verifyCredentials(email, password);

  if (!user) {
    return c.html(
      <Layout title="Masuk">
        <div class="gt-card w-full max-w-sm shadow-sm p-6">
          <h1 class="gt-accent-text text-xl font-semibold mb-1">GezyTeach</h1>
          <Alert variant="error">Email atau password salah.</Alert>
          <form method="post" action="/login">
            <FormInput
              label="Email"
              name="email"
              type="email"
              value={email}
              required
              autofocus
            />
            <FormInput
              label="Password"
              name="password"
              type="password"
              required
            />
            <button
              type="submit"
              class="gt-btn-primary w-full py-2.5 transition"
            >
              Masuk
            </button>
          </form>
        </div>
      </Layout>,
      401,
    );
  }

  const session = await createSession(user.id);

  setCookie(c, SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });

  return c.redirect("/app");
});

authRoutes.post("/logout", async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE);
  await destroySession(sessionId);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.redirect("/login");
});
