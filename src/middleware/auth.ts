import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { getSessionUser, type SessionUser } from "../services/auth.service";

export const SESSION_COOKIE = "gezyteach_session";

declare module "hono" {
  interface ContextVariableMap {
    user: SessionUser;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const sessionId = getCookie(c, SESSION_COOKIE);
  const user = await getSessionUser(sessionId);

  if (!user) {
    return c.redirect("/login");
  }

  c.set("user", user);
  await next();
}
