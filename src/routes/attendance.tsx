import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import {
  getAttendanceForSchedule,
  saveAttendance,
  type AttendanceStatus,
} from "../services/attendance.service";
import {
  getScheduleForUser,
  listSchedulesByUser,
} from "../services/schedule.service";
import { Layout } from "../components/Layout";
import { todayIso, formatDateLabel } from "../utils/dates";

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
