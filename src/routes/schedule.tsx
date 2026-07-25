import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import { listClassesWithStudentCount } from "../services/class.service";
import {
  createSchedule,
  deleteSchedule,
  listSchedulesByUser,
} from "../services/schedule.service";
import { Layout } from "../components/Layout";
import { DAY_NAMES } from "../utils/dates";

type AppContext = {
  Variables: { user: SessionUser };
};

export const scheduleRoutes = new Hono<AppContext>();

type ScheduleRow = Awaited<ReturnType<typeof listSchedulesByUser>>[number];

function SchedulePage({
  user,
  classes,
  schedulesByDay,
}: {
  user: SessionUser;
  classes: Awaited<ReturnType<typeof listClassesWithStudentCount>>;
  schedulesByDay: Map<number, ScheduleRow[]>;
}) {
  // Senin (1) s.d. Sabtu (6), lalu Minggu (0) di akhir jika ada isinya
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Layout title="Jadwal" user={user} activeNav="schedule">
      <h1 class="text-xl font-semibold mb-4">Jadwal Mengajar</h1>

      <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <h2 class="font-medium mb-3">Tambah Jadwal</h2>
        {classes.length === 0 ? (
          <p class="text-sm text-slate-500">
            Tambahkan kelas terlebih dahulu di menu{" "}
            <a href="/app/students" class="text-emerald-700 underline">
              Data Siswa
            </a>{" "}
            sebelum membuat jadwal.
          </p>
        ) : (
          <form
            method="post"
            action="/app/schedule"
            class="grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            <select
              name="classId"
              required
              class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Pilih kelas</option>
              {classes.map((k) => (
                <option value={k.id}>{k.name}</option>
              ))}
            </select>
            <input
              type="text"
              name="subject"
              placeholder="Mata pelajaran"
              required
              class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              name="dayOfWeek"
              required
              class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Pilih hari</option>
              {dayOrder.map((d) => (
                <option value={d}>{DAY_NAMES[d]}</option>
              ))}
            </select>
            <input
              type="text"
              name="room"
              placeholder="Ruang (opsional)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <input
              type="time"
              name="startTime"
              required
              class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <input
              type="time"
              name="endTime"
              required
              class="rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              class="sm:col-span-2 bg-emerald-600 text-white rounded-lg py-2 font-medium hover:bg-emerald-700"
            >
              Tambah Jadwal
            </button>
          </form>
        )}
      </div>

      <div class="space-y-4">
        {dayOrder.map((day) => {
          const items = schedulesByDay.get(day) ?? [];
          if (items.length === 0) return null;

          return (
            <div>
              <h3 class="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                {DAY_NAMES[day]}
              </h3>
              <div class="space-y-2">
                {items.map((s) => (
                  <div class="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                    <div>
                      <p class="font-medium">
                        {s.subject} · {s.class.name}
                      </p>
                      <p class="text-sm text-slate-500">
                        {s.startTime}–{s.endTime}
                        {s.room ? ` · ${s.room}` : ""}
                      </p>
                    </div>
                    <button
                      hx-delete={`/app/schedule/${s.id}`}
                      hx-confirm="Hapus jadwal ini?"
                      hx-target="closest div.bg-white"
                      hx-swap="outerHTML"
                      class="text-red-600 text-xs font-medium shrink-0 ml-2"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {schedulesByDay.size === 0 && (
          <p class="text-sm text-slate-500 text-center py-8">
            Belum ada jadwal. Tambahkan jadwal pertama Anda di atas.
          </p>
        )}
      </div>
    </Layout>
  );
}

scheduleRoutes.get("/app/schedule", async (c) => {
  const user = c.get("user");
  const [classes, schedules] = await Promise.all([
    listClassesWithStudentCount(),
    listSchedulesByUser(user.id),
  ]);

  const schedulesByDay = new Map<number, ScheduleRow[]>();
  for (const s of schedules) {
    const list = schedulesByDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    schedulesByDay.set(s.dayOfWeek, list);
  }

  return c.html(
    <SchedulePage
      user={user}
      classes={classes}
      schedulesByDay={schedulesByDay}
    />,
  );
});

scheduleRoutes.post("/app/schedule", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const classId = Number(body.classId);
  const subject = String(body.subject ?? "").trim();
  const dayOfWeek = Number(body.dayOfWeek);
  const startTime = String(body.startTime ?? "").trim();
  const endTime = String(body.endTime ?? "").trim();
  const room = String(body.room ?? "").trim() || undefined;

  if (classId && subject && startTime && endTime && !Number.isNaN(dayOfWeek)) {
    await createSchedule(user.id, {
      classId,
      subject,
      dayOfWeek,
      startTime,
      endTime,
      room,
    });
  }

  return c.redirect("/app/schedule");
});

scheduleRoutes.delete("/app/schedule/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  await deleteSchedule(user.id, id);
  return c.body(null);
});
