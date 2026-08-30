import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import {
  getAttendanceForSchedule,
  listAttendanceExecutions,
  saveAttendance,
  type AttendanceStatus,
} from "../services/attendance.service";
import {
  getScheduleForUser,
  listSchedulesByUser,
} from "../services/schedule.service";
import { Layout } from "../components/Layout";
import { DAY_NAMES, dayOfWeekFromIso, todayIso, formatDateLabel } from "../utils/dates";

type AppContext = {
  Variables: { user: SessionUser };
};

export const attendanceRoutes = new Hono<AppContext>();

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  H: "Hadir",
  S: "Sakit",
  I: "Izin",
  A: "Alpa",
};

const MONTHS = [
  ["01", "Januari"],
  ["02", "Februari"],
  ["03", "Maret"],
  ["04", "April"],
  ["05", "Mei"],
  ["06", "Juni"],
  ["07", "Juli"],
  ["08", "Agustus"],
  ["09", "September"],
  ["10", "Oktober"],
  ["11", "November"],
  ["12", "Desember"],
] as const;

function AttendanceTabs({ active }: { active: "students" | "history" }) {
  const tabClass = "inline-flex items-center px-3 py-2 whitespace-nowrap";
  return (
    <div class="flex gap-2 mb-5 text-sm overflow-x-auto no-scrollbar">
      <a
        href="/app/attendance"
        class={`${tabClass} ${active === "students" ? "gt-btn-primary" : "gt-btn-secondary"}`}
      >
        Absensi Siswa
      </a>
      <a
        href="/app/attendance/history"
        class={`${tabClass} ${active === "history" ? "gt-btn-primary" : "gt-btn-secondary"}`}
      >
        Pelaksanaan
      </a>
    </div>
  );
}

function formatDateOnly(dateIso: string) {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

attendanceRoutes.get("/app/attendance", async (c) => {
  const user = c.get("user");
  const date = c.req.query("date") || todayIso();
  const scheduleId = c.req.query("scheduleId")
    ? Number(c.req.query("scheduleId"))
    : undefined;

  const schedules = await listSchedulesByUser(user.id);
  const selectedSchedule = scheduleId
    ? schedules.find((s) => s.id === scheduleId)
    : undefined;

  const attendanceList = selectedSchedule
    ? await getAttendanceForSchedule(
        selectedSchedule.id,
        selectedSchedule.classId,
        date,
      )
    : [];

  return c.html(
    <Layout title="Absensi" user={user} activeNav="attendance">
      <AttendanceTabs active="students" />
      <h1 class="text-xl font-semibold mb-4">Absensi Siswa</h1>

      <form
        method="get"
        action="/app/attendance"
        class="gt-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        <select name="scheduleId" required class="gt-input">
          <option value="">Pilih kelas & mapel</option>
          {schedules.map((s) => (
            <option value={s.id} selected={s.id === scheduleId}>
              {s.class.name} · {s.subject}
            </option>
          ))}
        </select>
        <input type="date" name="date" value={date} class="gt-input" />
        <button type="submit" class="gt-btn-primary sm:col-span-2 py-2">
          Tampilkan
        </button>
      </form>

      {schedules.length === 0 && (
        <p class="gt-muted text-sm text-center py-8">
          Belum ada jadwal. Tambahkan jadwal di menu Jadwal terlebih dahulu.
        </p>
      )}

      {selectedSchedule && (
        <div class="gt-card p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="font-medium">
                {selectedSchedule.class.name} · {selectedSchedule.subject}
              </p>
              <p class="gt-muted text-sm">{formatDateLabel(date)}</p>
            </div>
            <button
              type="button"
              onclick="document.querySelectorAll('select[name^=status]').forEach(s => s.value = 'H')"
              class="gt-btn-secondary text-xs px-3 py-1.5 shrink-0"
            >
              Semua Hadir
            </button>
          </div>

          <form
            method="post"
            action={`/app/attendance?scheduleId=${selectedSchedule.id}&date=${date}`}
          >
            <div class="space-y-2">
              {attendanceList.map((item) => (
                <div class="gt-table-row-border flex items-center justify-between gap-2 pb-2 last:border-0">
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate">
                      {item.student.name}
                    </p>
                    {item.student.nis && (
                      <p class="gt-subtle text-xs">{item.student.nis}</p>
                    )}
                  </div>
                  <select
                    name={`status_${item.student.id}`}
                    class="gt-input text-sm py-1.5 shrink-0 w-auto"
                  >
                    {(["H", "S", "I", "A"] as AttendanceStatus[]).map(
                      (status) => (
                        <option
                          value={status}
                          selected={(item.status ?? "H") === status}
                        >
                          {STATUS_LABELS[status]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              ))}
            </div>

            {attendanceList.length === 0 && (
              <p class="gt-muted text-sm text-center py-6">
                Belum ada siswa di kelas ini.
              </p>
            )}

            {attendanceList.length > 0 && (
              <button type="submit" class="gt-btn-primary w-full mt-4 py-2.5">
                Simpan Absensi
              </button>
            )}
          </form>
        </div>
      )}
    </Layout>,
  );
});

attendanceRoutes.get("/app/attendance/history", async (c) => {
  const user = c.get("user");
  const schedules = await listSchedulesByUser(user.id);
  const availableClasses = [
    ...new Map(
      schedules.map((schedule) => [
        schedule.classId,
        { id: schedule.classId, name: schedule.class.name },
      ]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "id"));
  const requestedClassId = Number(c.req.query("classId"));
  const classId = availableClasses.some((item) => item.id === requestedClassId)
    ? requestedClassId
    : availableClasses[0]?.id;
  const requestedMonth = c.req.query("month");
  const currentMonth = todayIso().slice(5, 7);
  const month = requestedMonth === "all" || MONTHS.some(([value]) => value === requestedMonth)
    ? requestedMonth
    : currentMonth;
  const executions = classId
    ? await listAttendanceExecutions(
        user.id,
        classId,
        month === "all" ? undefined : month,
      )
    : [];
  const selectedClass = availableClasses.find((item) => item.id === classId);
  const monthLabel = month === "all"
    ? "Semua Bulan"
    : MONTHS.find(([value]) => value === month)?.[1];

  return c.html(
    <Layout title="Pelaksanaan Absensi" user={user} activeNav="attendance">
      <AttendanceTabs active="history" />
      <h1 class="text-xl font-semibold mb-1">Pelaksanaan Absensi</h1>
      <p class="gt-muted text-sm mb-4">
        Riwayat absensi yang sudah tersimpan.
      </p>

      <form
        method="get"
        action="/app/attendance/history"
        class="gt-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        <label class="block">
          <span class="gt-label">Kelas</span>
          <select name="classId" required class="gt-input">
            {availableClasses.map((item) => (
              <option value={item.id} selected={item.id === classId}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label class="block">
          <span class="gt-label">Bulan</span>
          <select name="month" class="gt-input">
            <option value="all" selected={month === "all"}>Semua Bulan</option>
            {MONTHS.map(([value, label]) => (
              <option value={value} selected={month === value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="submit" class="gt-btn-primary sm:col-span-2 py-2">
          Tampilkan
        </button>
      </form>

      {availableClasses.length === 0 && (
        <p class="gt-muted text-sm text-center py-8">
          Belum ada jadwal. Tambahkan jadwal di menu Jadwal terlebih dahulu.
        </p>
      )}

      {selectedClass && (
        <div class="gt-card p-4">
          <div class="mb-3">
            <p class="font-medium">Kelas {selectedClass.name}</p>
            <p class="gt-muted text-sm">Bulan: {monthLabel}</p>
          </div>

          {executions.length > 0 ? (
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left gt-muted text-xs border-b">
                    <th class="py-2 pr-3 whitespace-nowrap">Hari</th>
                    <th class="py-2 pr-3 whitespace-nowrap">Tanggal</th>
                    <th class="py-2 pr-3 whitespace-nowrap">Kelas</th>
                    <th class="py-2 pr-3 whitespace-nowrap">Mata Pelajaran</th>
                    <th class="py-2 pr-3 text-center whitespace-nowrap">Status</th>
                    <th class="py-2 px-2 text-center whitespace-nowrap">Diabsen</th>
                    <th class="py-2 pl-2 text-center whitespace-nowrap">Tidak Hadir</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((execution) => (
                    <tr class="gt-table-row-border">
                      <td class="py-2 pr-3 whitespace-nowrap">
                        {DAY_NAMES[dayOfWeekFromIso(execution.date)]}
                      </td>
                      <td class="py-2 pr-3 whitespace-nowrap">
                        {formatDateOnly(execution.date)}
                      </td>
                      <td class="py-2 pr-3 font-medium whitespace-nowrap">
                        {execution.className}
                      </td>
                      <td class="py-2 pr-3">{execution.subjects.replaceAll(",", ", ")}</td>
                      <td class="py-2 pr-3 text-center">
                        <span class="gt-badge-emerald px-2 py-1 rounded-full text-xs">
                          Terlaksana
                        </span>
                      </td>
                      <td class="py-2 px-2 text-center">{execution.studentCount}</td>
                      <td class="py-2 pl-2 text-center">{execution.absentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p class="gt-muted text-sm text-center py-6">
              Belum ada pelaksanaan absensi untuk filter ini.
            </p>
          )}
        </div>
      )}
    </Layout>,
  );
});

attendanceRoutes.post("/app/attendance", async (c) => {
  const user = c.get("user");
  const scheduleId = Number(c.req.query("scheduleId"));
  const date = c.req.query("date") || todayIso();

  const schedule = await getScheduleForUser(user.id, scheduleId);
  if (!schedule) return c.redirect("/app/attendance");

  const body = await c.req.parseBody();
  const entries: { studentId: number; status: AttendanceStatus }[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (!key.startsWith("status_")) continue;
    const studentId = Number(key.replace("status_", ""));
    const status = String(value) as AttendanceStatus;
    if (["H", "S", "I", "A"].includes(status)) {
      entries.push({ studentId, status });
    }
  }

  await saveAttendance(scheduleId, date, entries);

  return c.redirect(`/app/attendance?scheduleId=${scheduleId}&date=${date}`);
});
