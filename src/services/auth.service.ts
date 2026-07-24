import { eq } from "drizzle-orm";
import { db } from "../db";
import { sessions, users } from "../db/schema";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 hari

export type SessionUser = {
  id: number;
  name: string;
  email: string;
};

function generateSessionId(): string {
  return crypto.randomUUID();
}

export async function verifyCredentials(email: string, password: string) {
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
  });

  if (!user) return null;

  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) return null;

  return user;
}

export async function createSession(userId: number): Promise<{
  id: string;
  expiresAt: number;
}> {
  const id = generateSessionId();
  const expiresAt = Date.now() + SESSION_TTL_MS;

  await db.insert(sessions).values({ id, userId, expiresAt });

  return { id, expiresAt };
}

export async function getSessionUser(
  sessionId: string | undefined,
): Promise<SessionUser | null> {
  if (!sessionId) return null;

  const session = await db.query.sessions.findFirst({
    where: (s, { eq }) => eq(s.id, sessionId),
  });

  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, session.userId),
  });

  if (!user) return null;

  return { id: user.id, name: user.name, email: user.email };
}

export async function destroySession(sessionId: string | undefined) {
  if (!sessionId) return;
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
