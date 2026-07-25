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
      <p class="text-sm text-slate-500 mb-6">
        {profile?.class.name ?? "-"} · NIS {student.loginId}
      </p>

      <div class="grid grid-cols-2 gap-3 mb-6">
        <div class="bg-white rounded-2xl border border-slate-200 p-4">
          <p class="text-2xl font-semibold text-emerald-700">
            {attendance.countByStatus.H ?? 0}
          </p>
          <p class="text-sm text-slate-500">Hadir</p>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-4">
          <p class="text-2xl font-semibold text-red-600">
            {attendance.countByStatus.A ?? 0}
          </p>
          <p class="text-sm text-slate-500">Alpa</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <a
          href="/siswa/absensi"
          class="bg-white rounded-2xl border border-slate-200 p-4 text-center hover:border-emerald-300"
        >
          <span class="text-2xl">✅</span>
          <p class="text-sm font-medium mt-1">Absensi</p>
        </a>
        <a
          href="/siswa/nilai"
          class="bg-white rounded-2xl border border-slate-200 p-4 text-center hover:border-emerald-300"
        >
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
    H: "bg-emerald-50 text-emerald-700",
    S: "bg-amber-50 text-amber-700",
    I: "bg-blue-50 text-blue-700",
    A: "bg-red-50 text-red-700",
  };

  return c.html(
    <StudentLayout title="Absensi" student={student} activeNav="attendance">
      <h1 class="text-xl font-semibold mb-4">Rekap Absensi</h1>

      <div class="grid grid-cols-4 gap-2 mb-6">
        {(["H", "S", "I", "A"] as const).map((status) => (
          <div class="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p class="text-lg font-semibold">
              {attendance.countByStatus[status] ?? 0}
            </p>
            <p class="text-xs text-slate-500">{status}</p>
          </div>
        ))}
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="text-left px-3 py-2">Tanggal</th>
              <th class="text-left px-3 py-2">Mapel</th>
              <th class="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.recent.map((item) => (
              <tr class="border-t border-slate-100">
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
                <td colspan={3} class="px-3 py-6 text-center text-slate-400">
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
        <p class="text-sm text-slate-500 text-center py-8">
          Belum ada nilai yang tercatat.
        </p>
      )}

      <div class="space-y-4">
        {subjects.map((subject) => (
          <div class="bg-white rounded-2xl border border-slate-200 p-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="font-medium">{subject.subject}</h2>
              <span class="text-lg font-semibold text-emerald-700">
                {subject.finalScore !== null
                  ? subject.finalScore.toFixed(1)
                  : "-"}
              </span>
            </div>
            <div class="space-y-1">
              {subject.components.map((comp) => (
                <div class="flex items-center justify-between text-sm text-slate-600">
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

      <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <p class="text-sm text-slate-500">Nama</p>
        <p class="font-medium mb-2">{student.name}</p>
        <p class="text-sm text-slate-500">NIS</p>
        <p class="font-medium">{student.loginId}</p>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
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
            <span class="block text-sm font-medium text-slate-700 mb-1">
              PIN Saat Ini
            </span>
            <input
              type="password"
              name="currentPin"
              inputmode="numeric"
              required
              autofocus
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </label>
          <label class="block mb-4">
            <span class="block text-sm font-medium text-slate-700 mb-1">
              PIN Baru (4-6 digit)
            </span>
            <input
              type="password"
              name="newPin"
              inputmode="numeric"
              required
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </label>
          <label class="block mb-4">
            <span class="block text-sm font-medium text-slate-700 mb-1">
              Konfirmasi PIN Baru
            </span>
            <input
              type="password"
              name="confirmPin"
              inputmode="numeric"
              required
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </label>
          <button
            type="submit"
            class="w-full bg-emerald-600 text-white rounded-lg py-2.5 font-medium hover:bg-emerald-700 transition"
          >
            Simpan PIN Baru
          </button>
        </form>
      </div>

      <form method="post" action="/siswa/logout">
        <button
          type="submit"
          class="w-full bg-slate-100 text-slate-700 rounded-lg py-2.5 font-medium hover:bg-slate-200 transition"
        >
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
