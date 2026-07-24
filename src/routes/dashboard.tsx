import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import { listClassesWithStudentCount } from "../services/class.service";
import { Layout } from "../components/Layout";

type AppContext = {
  Variables: { user: SessionUser };
};

export const dashboardRoutes = new Hono<AppContext>();

const DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

dashboardRoutes.get("/app", async (c) => {
  const user = c.get("user");
  const classes = await listClassesWithStudentCount(user.id);
  const totalStudents = classes.reduce((sum, k) => sum + k.studentCount, 0);
  const today = new Date();
  const todayLabel = `${DAY_NAMES[today.getDay()]}, ${today.toLocaleDateString(
    "id-ID",
    { day: "numeric", month: "long", year: "numeric" },
  )}`;

  return c.html(
    <Layout title="Beranda" user={user} activeNav="dashboard">
      <h1 class="text-xl font-semibold mb-1">Halo, {user.name} 👋</h1>
      <p class="text-sm text-slate-500 mb-6">{todayLabel}</p>

      <div class="grid grid-cols-2 gap-3 mb-6">
        <div class="bg-white rounded-2xl border border-slate-200 p-4">
          <p class="text-2xl font-semibold text-emerald-700">
            {classes.length}
          </p>
          <p class="text-sm text-slate-500">Kelas</p>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-4">
          <p class="text-2xl font-semibold text-emerald-700">
            {totalStudents}
          </p>
          <p class="text-sm text-slate-500">Siswa</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <a
          href="/app/schedule"
          class="bg-white rounded-2xl border border-slate-200 p-4 text-center hover:border-emerald-300"
        >
          <span class="text-2xl">🗓️</span>
          <p class="text-sm font-medium mt-1">Jadwal</p>
        </a>
        <a
          href="/app/journal"
          class="bg-white rounded-2xl border border-slate-200 p-4 text-center hover:border-emerald-300"
        >
          <span class="text-2xl">📝</span>
          <p class="text-sm font-medium mt-1">Jurnal</p>
        </a>
        <a
          href="/app/attendance"
          class="bg-white rounded-2xl border border-slate-200 p-4 text-center hover:border-emerald-300"
        >
          <span class="text-2xl">✅</span>
          <p class="text-sm font-medium mt-1">Absensi</p>
        </a>
        <a
          href="/app/scores"
          class="bg-white rounded-2xl border border-slate-200 p-4 text-center hover:border-emerald-300"
        >
          <span class="text-2xl">📊</span>
          <p class="text-sm font-medium mt-1">Nilai</p>
        </a>
      </div>
    </Layout>,
  );
});
