import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import { getAttendanceRecap } from "../services/attendance-recap.service";
import { Layout } from "../components/Layout";
import { todayIso } from "../utils/dates";
import { toCsv } from "../utils/csv";

type AppContext = {
  Variables: { user: SessionUser };
};

export const attendanceRecapRoutes = new Hono<AppContext>();

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

attendanceRecapRoutes.get("/app/attendance/recap", async (c) => {
  const user = c.get("user");
  const start = c.req.query("start") || daysAgoIso(29);
  const end = c.req.query("end") || todayIso();
  const recap = await getAttendanceRecap(user.id, start, end);

  return c.html(
    <Layout title="Rekap Absensi" user={user} activeNav="recap">
      <h1 class="text-xl font-semibold mb-1">Rekapitulasi Absensi</h1>
      <p class="gt-muted text-sm mb-4">
        Ringkasan kehadiran per murid dalam rentang tanggal.
      </p>

      <form
        method="get"
        action="/app/attendance/recap"
        class="gt-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2"
      >
        <label class="block">
          <span class="gt-label">Dari</span>
          <input type="date" name="start" value={start} class="gt-input" />
        </label>
        <label class="block">
          <span class="gt-label">Sampai</span>
          <input type="date" name="end" value={end} class="gt-input" />
        </label>
        <div class="flex items-end gap-2">
          <button type="submit" class="gt-btn-primary flex-1 py-2">
            Tampilkan
          </button>
          <a
            href={`/app/attendance/recap/export.csv?start=${start}&end=${end}`}
            class="gt-btn-secondary py-2 px-3 text-sm whitespace-nowrap"
          >
            ⬇ CSV
          </a>
        </div>
      </form>

      {recap.length === 0 && (
        <p class="gt-muted text-sm text-center py-8">
          Belum ada jadwal mengajar. Tambahkan jadwal di menu Jadwal terlebih
          dahulu.
        </p>
      )}

      {recap.map((cls) => (
        <div class="gt-card p-4 mb-4">
          <div class="flex items-center justify-between mb-2">
            <div>
              <p class="font-semibold">Kelas {cls.className}</p>
              <p class="gt-muted text-xs">
                {cls.subjects.join(", ")} · {start} s.d. {end}
              </p>
            </div>
            <div class="text-right text-xs gt-muted">
              <p>
                H:{" "}
                <span class="gt-accent-text font-semibold">{cls.totals.h}</span>
              </p>
              <p>
                S: {cls.totals.s} · I: {cls.totals.i} · A:{" "}
                <span class="font-semibold text-red-600 dark:text-red-400">
                  {cls.totals.a}
                </span>
              </p>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left gt-muted text-xs border-b">
                  <th class="py-1 pr-2 whitespace-nowrap">NIS</th>
                  <th class="py-1 pr-2">Nama</th>
                  <th class="py-1 px-1 text-center">H</th>
                  <th class="py-1 px-1 text-center">S</th>
                  <th class="py-1 px-1 text-center">I</th>
                  <th class="py-1 px-1 text-center">A</th>
                  <th class="py-1 px-1 text-center">Jml</th>
                  <th class="py-1 pl-2 text-right">% Hadir</th>
                </tr>
              </thead>
              <tbody>
                {cls.rows.map((r) => (
                  <tr class="border-b border-gray-100 dark:border-gray-800">
                    <td class="py-1.5 pr-2 gt-subtle text-xs whitespace-nowrap">
                      {r.nis ?? "-"}
                    </td>
                    <td class="py-1.5 pr-2 font-medium">{r.name}</td>
                    <td class="py-1.5 px-1 text-center">{r.h}</td>
                    <td class="py-1.5 px-1 text-center">{r.s}</td>
                    <td class="py-1.5 px-1 text-center">{r.i}</td>
                    <td class="py-1.5 px-1 text-center">{r.a}</td>
                    <td class="py-1.5 px-1 text-center gt-muted">
                      {r.total || "-"}
                    </td>
                    <td class="py-1.5 pl-2 text-right">
                      {r.pct === null ? "-" : `${r.pct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </Layout>,
  );
});

attendanceRecapRoutes.get("/app/attendance/recap/export.csv", async (c) => {
  const user = c.get("user");
  const start = c.req.query("start") || daysAgoIso(29);
  const end = c.req.query("end") || todayIso();
  const recap = await getAttendanceRecap(user.id, start, end);

  const headers = [
    "Kelas",
    "NIS",
    "Nama",
    "H",
    "S",
    "I",
    "A",
    "Jumlah",
    "Persen Hadir",
  ];
  const rows: (string | number)[][] = [];
  for (const cls of recap) {
    for (const r of cls.rows) {
      rows.push([
        cls.className,
        r.nis ?? "",
        r.name,
        r.h,
        r.s,
        r.i,
        r.a,
        r.total,
        r.pct === null ? "" : r.pct,
      ]);
    }
  }

  const csv = "\uFEFF" + toCsv(headers, rows); // BOM agar Excel membaca UTF-8
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header(
    "Content-Disposition",
    `attachment; filename="rekap-absensi-${start}-${end}.csv"`,
  );
  return c.body(csv);
});
