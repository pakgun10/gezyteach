import { eq } from "drizzle-orm";
import { db } from "../db";
import { studentSessions, students } from "../db/schema";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 hari

export type SessionStudent = {
  id: number;
  classId: number;
  name: string;
  loginId: string;
};

function generateSessionId(): string {
  return crypto.randomUUID();
}

/** Generate PIN numerik acak sepanjang `length` digit (default 4). */
export function generatePin(length = 4): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  const value = min + Math.floor(Math.random() * (max - min + 1));
  return String(value);
}

/**
 * Aktifkan/reset akun login siswa dengan PIN baru.
 * `loginId` wajib sudah terisi sebelum akun bisa diaktifkan.
 */
export async function setStudentPin(studentId: number, pin: string) {
  const pinHash = await Bun.password.hash(pin);
  await db
    .update(students)
    .set({ pinHash, updatedAt: Date.now() })
    .where(eq(students.id, studentId));
}

/** Ambil bagian NIS lokal sekolah dari NIS gabungan "NISN/NIS-lokal", atau NIS itu sendiri jika tidak ada "/". */
function deriveLoginIdFromNis(nis: string): string {
  const trimmed = nis.trim();
  return trimmed.includes("/") ? trimmed.split("/")[1]!.trim() : trimmed;
}

export type ActivateLoginResult =
  | { ok: true; loginId: string; pin: string }
  | { ok: false; error: "no_nis" | "login_id_taken" };

/**
 * Aktifkan atau reset login siswa: pastikan `loginId` terisi (derive dari NIS
 * jika belum ada), generate PIN baru, dan simpan hash-nya.
 * PIN plaintext hanya dikembalikan sekali di sini untuk ditunjukkan ke guru.
 */
export async function activateOrResetStudentLogin(
  studentId: number,
): Promise<ActivateLoginResult> {
  const student = await db.query.students.findFirst({
    where: (s, { eq: eqFn }) => eqFn(s.id, studentId),
  });

  if (!student) return { ok: false, error: "no_nis" };

  let loginId = student.loginId;

  if (!loginId) {
    if (!student.nis || !student.nis.trim()) {
      return { ok: false, error: "no_nis" };
    }

    loginId = deriveLoginIdFromNis(student.nis);

    const existing = await db.query.students.findFirst({
      where: (s, { eq: eqFn }) => eqFn(s.loginId, loginId!),
    });

    if (existing && existing.id !== studentId) {
      return { ok: false, error: "login_id_taken" };
    }
  }

  const pin = generatePin();
  const pinHash = await Bun.password.hash(pin);

  await db
    .update(students)
    .set({ loginId, pinHash, updatedAt: Date.now() })
    .where(eq(students.id, studentId));

  return { ok: true, loginId, pin };
}

export type ActivateAllResult = {
  activated: {
    studentId: number;
    studentName: string;
    loginId: string;
    pin: string;
  }[];
  failed: {
    studentId: number;
    studentName: string;
    error: "no_nis" | "login_id_taken";
  }[];
};

/**
 * Aktifkan/reset login untuk semua siswa dalam daftar `studentIds`.
 * Siswa yang gagal (tanpa NIS atau NIS lokal bentrok) dilewati dan dicatat
 * di `failed`, tidak menghentikan proses untuk siswa lain.
 */
export async function activateOrResetLoginForStudents(
  studentsToActivate: { id: number; name: string }[],
): Promise<ActivateAllResult> {
  const result: ActivateAllResult = { activated: [], failed: [] };

  for (const student of studentsToActivate) {
    const outcome = await activateOrResetStudentLogin(student.id);

    if (outcome.ok) {
      result.activated.push({
        studentId: student.id,
        studentName: student.name,
        loginId: outcome.loginId,
        pin: outcome.pin,
      });
    } else {
      result.failed.push({
        studentId: student.id,
        studentName: student.name,
        error: outcome.error,
      });
    }
  }

  return result;
}

/** Nonaktifkan login siswa (hapus PIN, hapus semua sesi aktif). */
export async function disableStudentLogin(studentId: number) {
  await db
    .update(students)
    .set({ pinHash: null, updatedAt: Date.now() })
    .where(eq(students.id, studentId));
  await db
    .delete(studentSessions)
    .where(eq(studentSessions.studentId, studentId));
}

export async function verifyStudentCredentials(loginId: string, pin: string) {
  const student = await db.query.students.findFirst({
    where: (s, { eq: eqFn }) => eqFn(s.loginId, loginId),
  });

  if (!student || !student.pinHash) return null;
  if (!student.active) return null;

  const valid = await Bun.password.verify(pin, student.pinHash);
  if (!valid) return null;

  return student;
}

export async function createStudentSession(studentId: number): Promise<{
  id: string;
  expiresAt: number;
}> {
  const id = generateSessionId();
  const expiresAt = Date.now() + SESSION_TTL_MS;

  await db.insert(studentSessions).values({ id, studentId, expiresAt });

  return { id, expiresAt };
}

export async function getSessionStudent(
  sessionId: string | undefined,
): Promise<SessionStudent | null> {
  if (!sessionId) return null;

  const session = await db.query.studentSessions.findFirst({
    where: (s, { eq: eqFn }) => eqFn(s.id, sessionId),
  });

  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    await db.delete(studentSessions).where(eq(studentSessions.id, sessionId));
    return null;
  }

  const student = await db.query.students.findFirst({
    where: (s, { eq: eqFn }) => eqFn(s.id, session.studentId),
  });

  if (!student || !student.active || !student.loginId) return null;

  return {
    id: student.id,
    classId: student.classId,
    name: student.name,
    loginId: student.loginId,
  };
}

export async function destroyStudentSession(sessionId: string | undefined) {
  if (!sessionId) return;
  await db.delete(studentSessions).where(eq(studentSessions.id, sessionId));
}

export type ChangeStudentPinResult =
  { ok: true } | { ok: false; error: "invalid_current" | "invalid_format" };

const PIN_LENGTH = 4;

export async function changeStudentPin(
  studentId: number,
  currentPin: string,
  newPin: string,
): Promise<ChangeStudentPinResult> {
  const student = await db.query.students.findFirst({
    where: (s, { eq: eqFn }) => eqFn(s.id, studentId),
  });

  if (!student || !student.pinHash) {
    return { ok: false, error: "invalid_current" };
  }

  const valid = await Bun.password.verify(currentPin, student.pinHash);
  if (!valid) return { ok: false, error: "invalid_current" };

  if (!/^\d{4,6}$/.test(newPin)) {
    return { ok: false, error: "invalid_format" };
  }

  const pinHash = await Bun.password.hash(newPin);
  await db
    .update(students)
    .set({ pinHash, updatedAt: Date.now() })
    .where(eq(students.id, studentId));

  return { ok: true };
}
