import { Hono } from "hono";
import { Alert } from "../components/Alert";
import { StudentLayout } from "../components/StudentLayout";
import type { SessionStudent } from "../services/student-auth.service";
import { changeStudentPin } from "../services/student-auth.service";
import {
  getAttendanceSummary,
  getScoresForStudent,
  getStudentProfile,
} from "../services/student-portal.service";

type AppContext = {
  Variables: { student: SessionStudent };
};

export const studentPortalRoutes = new Hono<AppContext>();

studentPortalRoutes.get("/siswa", async (c) => {
  const student = c.get("student");
  const [profile, attendance] = await Promise.all([
    getStudentProfile(student.id),
    getAttendanceSummary(student.id),
  ]);

  return c.html(
    <StudentLayout title="Beranda" student={student} activeNav="dashboard">
      <h1 class="text-xl font-semibold mb-1">Halo, {student.name} 👋</h1>
      <p class="gt-muted text-sm mb-6">
        {profile?.class.name ?? "-"} · NIS {student.loginId}
      </p>

      <div class="grid grid-cols-2 gap-3 mb-6">
        <div class="gt-card p-4">
          <p class="gt-accent-text text-2xl font-semibold">
            {attendance.countByStatus.H ?? 0}
          </p>
          <p class="gt-muted text-sm">Hadir</p>
        </div>
        <div class="gt-card p-4">
          <p class="text-2xl font-semibold text-red-600 dark:text-red-400">
            {attendance.countByStatus.A ?? 0}
          </p>
          <p class="gt-muted text-sm">Alpa</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <a href="/siswa/absensi" class="gt-card gt-card-hover p-4 text-center">
          <span class="text-2xl">✅</span>
          <p class="text-sm font-medium mt-1">Absensi</p>
        </a>
        <a href="/siswa/nilai" class="gt-card gt-card-hover p-4 text-center">
          <span class="text-2xl">📊</span>
          <p class="text-sm font-medium mt-1">Nilai</p>
        </a>
      </div>
    </StudentLayout>,
  );
});

studentPortalRoutes.get("/siswa/absensi", async (c) => {
  const student = c.get("student");
  const attendance = await getAttendanceSummary(student.id);

  const STATUS_STYLES: Record<string, string> = {
    H: "gt-badge-emerald",
    S: "gt-badge-amber",
    I: "gt-badge-blue",
    A: "gt-badge-red",
  };

  return c.html(
    <StudentLayout title="Absensi" student={student} activeNav="attendance">
      <h1 class="text-xl font-semibold mb-4">Rekap Absensi</h1>

      <div class="grid grid-cols-4 gap-2 mb-6">
        {(["H", "S", "I", "A"] as const).map((status) => (
          <div class="gt-card p-3 text-center">
            <p class="text-lg font-semibold">
              {attendance.countByStatus[status] ?? 0}
            </p>
            <p class="gt-muted text-xs">{status}</p>
          </div>
        ))}
      </div>

      <div class="gt-card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="gt-table-head">
            <tr>
              <th class="text-left px-3 py-2">Tanggal</th>
              <th class="text-left px-3 py-2">Mapel</th>
              <th class="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.recent.map((item) => (
              <tr class="gt-table-row-border">
                <td class="px-3 py-2 whitespace-nowrap">{item.date}</td>
                <td class="px-3 py-2">{item.subject}</td>
                <td class="px-3 py-2">
                  <span
                    class={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                  >
                    {item.statusLabel}
                  </span>
                </td>
              </tr>
            ))}
            {attendance.recent.length === 0 && (
              <tr>
                <td colspan={3} class="px-3 py-6 text-center gt-subtle">
                  Belum ada data absensi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </StudentLayout>,
  );
});

studentPortalRoutes.get("/siswa/nilai", async (c) => {
  const student = c.get("student");
  const subjects = await getScoresForStudent(student.id, student.classId);

  return c.html(
    <StudentLayout title="Nilai" student={student} activeNav="scores">
      <h1 class="text-xl font-semibold mb-4">Nilai</h1>

      {subjects.length === 0 && (
        <p class="gt-muted text-sm text-center py-8">
          Belum ada nilai yang tercatat.
        </p>
      )}

      <div class="space-y-4">
        {subjects.map((subject) => (
          <div class="gt-card p-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-medium">{subject.subject}</h2>
              <span class="gt-accent-text text-lg font-semibold">
                {subject.finalScore !== null
                  ? subject.finalScore.toFixed(1)
                  : "-"}
              </span>
            </div>
            <div class="space-y-1">
              {subject.components.map((comp) => (
                <div class="gt-muted flex items-center justify-between text-sm">
                  <span>
                    {comp.name} (bobot {comp.weight})
                  </span>
                  <span class="font-medium">
                    {comp.value !== null ? comp.value : "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </StudentLayout>,
  );
});

function ProfilePage({
  student,
  error,
  success,
}: {
  student: SessionStudent;
  error?: string;
  success?: boolean;
}) {
  return (
    <StudentLayout title="Profil" student={student} activeNav="profile">
      <h1 class="text-xl font-semibold mb-4">Profil & Ganti PIN</h1>

      <div class="gt-card p-4 mb-4">
        <p class="gt-muted text-sm">Nama</p>
        <p class="font-medium mb-2">{student.name}</p>
        <p class="gt-muted text-sm">NIS</p>
        <p class="font-medium">{student.loginId}</p>
      </div>

      <div class="gt-card p-4 mb-4">
        <h2 class="font-medium mb-3">Ganti PIN</h2>

        {success && <Alert variant="success">PIN berhasil diubah.</Alert>}
        {error === "invalid_current" && (
          <Alert variant="error">PIN saat ini salah.</Alert>
        )}
        {error === "invalid_format" && (
          <Alert variant="error">PIN baru harus 4-6 digit angka.</Alert>
        )}
        {error === "mismatch" && (
          <Alert variant="error">Konfirmasi PIN baru tidak sama.</Alert>
        )}

        <form method="post" action="/siswa/profil/pin">
          <label class="block mb-4">
            <span class="gt-label">PIN Saat Ini</span>
            <input
              type="password"
              name="currentPin"
              inputmode="numeric"
              required
              autofocus
              class="gt-input"
            />
          </label>
          <label class="block mb-4">
            <span class="gt-label">PIN Baru (4-6 digit)</span>
            <input
              type="password"
              name="newPin"
              inputmode="numeric"
              required
              class="gt-input"
            />
          </label>
          <label class="block mb-4">
            <span class="gt-label">Konfirmasi PIN Baru</span>
            <input
              type="password"
              name="confirmPin"
              inputmode="numeric"
              required
              class="gt-input"
            />
          </label>
          <button type="submit" class="gt-btn-primary w-full py-2.5 transition">
            Simpan PIN Baru
          </button>
        </form>
      </div>

      <form method="post" action="/siswa/logout">
        <button type="submit" class="gt-btn-secondary w-full py-2.5 transition">
          Keluar
        </button>
      </form>
    </StudentLayout>
  );
}

studentPortalRoutes.get("/siswa/profil", (c) => {
  const student = c.get("student");
  return c.html(<ProfilePage student={student} />);
});

studentPortalRoutes.post("/siswa/profil/pin", async (c) => {
  const student = c.get("student");
  const body = await c.req.parseBody();

  const currentPin = String(body.currentPin ?? "");
  const newPin = String(body.newPin ?? "");
  const confirmPin = String(body.confirmPin ?? "");

  if (newPin !== confirmPin) {
    return c.html(<ProfilePage student={student} error="mismatch" />, 400);
  }

  const result = await changeStudentPin(student.id, currentPin, newPin);

  if (!result.ok) {
    return c.html(<ProfilePage student={student} error={result.error} />, 400);
  }

  return c.html(<ProfilePage student={student} success />);
});
