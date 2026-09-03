import { Hono } from "hono";
import { AttendanceTabs } from "../components/AttendanceTabs";
import { Layout } from "../components/Layout";
import type { SessionUser } from "../services/auth.service";
import {
  getAttendanceReportRecap,
  type AttendanceReportRecap,
} from "../services/attendance-recap.service";
import { getSchoolProfile } from "../services/school.service";
import { listSchedulesByUser } from "../services/schedule.service";
import { formatDateLabel, todayIso } from "../utils/dates";

type AppContext = {
  Variables: { user: SessionUser };
};

export const attendanceReportRoutes = new Hono<AppContext>();

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function defaultAcademicYear() {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function reportValue(value: string | null | undefined) {
  return value?.trim() || "—";
}

function subjectKey(subject: string) {
  return subject.trim().toLocaleLowerCase("id-ID");
}

function attendanceReportOptionKey(classId: number, subject: string) {
  return `${classId}:${subjectKey(subject)}`;
}

type ReportOption = {
  key: string;
  classId: number;
  className: string;
  subject: string;
  scheduleIds: number[];
};

function buildReportOptions(
  schedules: Awaited<ReturnType<typeof listSchedulesByUser>>,
): ReportOption[] {
  const grouped = new Map<string, ReportOption>();

  for (const schedule of schedules) {
    const subject = schedule.subject.trim();
    const key = attendanceReportOptionKey(schedule.classId, subject);
    const existing = grouped.get(key);
    if (existing) {
      existing.scheduleIds.push(schedule.id);
      continue;
    }
    grouped.set(key, {
      key,
      classId: schedule.classId,
      className: schedule.class.name,
      subject,
      scheduleIds: [schedule.id],
    });
  }

  return [...grouped.values()].sort((a, b) =>
    a.className.localeCompare(b.className, "id") || a.subject.localeCompare(b.subject, "id"),
  );
}

function AttendanceReportPage({
  user,
  profile,
  options,
  selectedOption,
  selectedOptionKey,
  dateFrom,
  dateTo,
  academicYear,
  semester,
  recap,
}: {
  user: SessionUser;
  profile: Awaited<ReturnType<typeof getSchoolProfile>>;
  options: ReportOption[];
  selectedOption?: ReportOption;
  selectedOptionKey?: string;
  dateFrom: string;
  dateTo: string;
  academicYear: string;
  semester: "1" | "2";
  recap: AttendanceReportRecap | null;
}) {
  const hasInvalidRange = dateFrom > dateTo;
  const canPrint = Boolean(recap && recap.totalMeetings > 0 && !hasInvalidRange);
  const location = [profile.address, profile.city].filter(Boolean).join(" · ");

  return (
    <Layout title="Print Rekap Kehadiran" user={user} activeNav="attendance" printMode>
      <div class="journal-report-page">
        <div class="journal-report-controls">
          <AttendanceTabs active="students" />
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h1 class="text-xl font-semibold">Print Rekap Kehadiran</h1>
              <p class="gt-muted text-sm mt-1">
                Pilih kelas, mata pelajaran, dan rentang tanggal, lalu simpan hasilnya sebagai PDF.
              </p>
            </div>
            <button
              type="button"
              onclick="window.print()"
              disabled={!canPrint}
              class="gt-btn-primary px-3 py-2 text-sm whitespace-nowrap"
            >
              🖨️ Cetak / Simpan PDF
            </button>
          </div>

          <form method="get" action="/app/attendance/report" class="gt-card p-4 mb-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="block sm:col-span-2">
                <span class="gt-label">Kelas & mata pelajaran</span>
                <select name="classSubject" required class="gt-input">
                  <option value="">Pilih kelas & mata pelajaran</option>
                  {options.map((option) => (
                    <option value={option.key} selected={option.key === selectedOptionKey}>
                      {option.className} · {option.subject}
                    </option>
                  ))}
                </select>
              </label>
              <label class="block">
                <span class="gt-label">Tanggal mulai</span>
                <input type="date" name="dateFrom" value={dateFrom} required class="gt-input" />
              </label>
              <label class="block">
                <span class="gt-label">Tanggal akhir</span>
                <input type="date" name="dateTo" value={dateTo} required class="gt-input" />
              </label>
              <label class="block">
                <span class="gt-label">Tahun pelajaran</span>
                <input
                  name="academicYear"
                  value={academicYear}
                  placeholder="Contoh: 2026/2027"
                  class="gt-input"
                />
              </label>
              <label class="block">
                <span class="gt-label">Semester</span>
                <select name="semester" class="gt-input">
                  <option value="1" selected={semester === "1"}>Semester 1</option>
                  <option value="2" selected={semester === "2"}>Semester 2</option>
                </select>
              </label>
            </div>
            <div class="flex gap-2 mt-4">
              <button type="submit" class="gt-btn-primary flex-1 py-2.5">
                Tampilkan Laporan
              </button>
              <a href="/app/attendance/report" class="gt-btn-secondary px-4 py-2.5">
                Reset
              </a>
            </div>
          </form>

          {hasInvalidRange && (
            <div class="gt-badge-red rounded-lg px-3 py-2 text-sm mb-4">
              Tanggal mulai tidak boleh lebih besar dari tanggal akhir.
            </div>
          )}
          {!profile.schoolName && (
            <div class="gt-badge-amber rounded-lg px-3 py-2 text-sm mb-4">
              Nama sekolah belum diatur. Admin dapat melengkapinya di menu Data Sekolah.
            </div>
          )}
          {options.length === 0 && (
            <div class="gt-badge-amber rounded-lg px-3 py-2 text-sm mb-4">
              Belum ada jadwal mengajar yang dapat dibuatkan laporan.
            </div>
          )}
          {selectedOption && recap && recap.totalMeetings === 0 && !hasInvalidRange && (
            <div class="gt-badge-amber rounded-lg px-3 py-2 text-sm mb-4">
              Belum ada absensi tersimpan pada jadwal dan rentang tanggal yang dipilih.
            </div>
          )}

        </div>

        <article class="journal-report-paper">
          <header class="journal-report-header">
            <p class="journal-report-title">LAPORAN REKAP KEHADIRAN SISWA</p>
            <h2>{profile.schoolName || "Nama Sekolah"}</h2>
            {location && <p>{location}</p>}
          </header>

          <div class="journal-report-meta">
            <div><span>Kelas</span><strong>{selectedOption?.className || "—"}</strong></div>
            <div><span>Mata Pelajaran</span><strong>{selectedOption?.subject || "—"}</strong></div>
            <div><span>Tahun Pelajaran</span><strong>{reportValue(academicYear)}</strong></div>
            <div><span>Semester</span><strong>Semester {semester}</strong></div>
            <div class="journal-report-meta-wide">
              <span>Periode</span>
              <strong>{formatDateLabel(dateFrom)} s.d. {formatDateLabel(dateTo)}</strong>
            </div>
            <div class="journal-report-meta-wide">
              <span>Total Pertemuan</span>
              <strong>{recap?.totalMeetings ?? 0}</strong>
            </div>
          </div>

          {recap && recap.totalMeetings > 0 ? (
            <div class="journal-report-table-wrap">
              <table class="journal-report-table attendance-report-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>NIS</th>
                    <th>Nama Siswa</th>
                    <th>Hadir (H)</th>
                    <th>Sakit (S)</th>
                    <th>Izin (I)</th>
                    <th>Alpa (A)</th>
                    <th>Total Pertemuan</th>
                    <th>Persentase Hadir</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.rows.map((row, index) => (
                    <tr>
                      <td>{index + 1}</td>
                      <td class="journal-report-text">{reportValue(row.nis)}</td>
                      <td class="journal-report-text">{row.name}</td>
                      <td>{row.h}</td>
                      <td>{row.s}</td>
                      <td>{row.i}</td>
                      <td>{row.a}</td>
                      <td>{row.total}</td>
                      <td>{row.pct === null ? "—" : `${row.pct}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p class="journal-report-empty">
              Tidak ada data absensi pada filter yang dipilih.
            </p>
          )}

          <div class="journal-report-signatures">
            <div class="journal-report-signature">
              <p>Mengetahui,<br />Kepala Sekolah</p>
              <div class="journal-report-signature-space" />
              <strong>{profile.principalName || "................................................"}</strong>
              <p>NIP. {profile.principalNip || "................................"}</p>
            </div>
            <div class="journal-report-signature">
              <p>{profile.city || "................"}, {formatDateLabel(todayIso())}<br />Guru Mata Pelajaran</p>
              <div class="journal-report-signature-space" />
              <strong>{user.name}</strong>
              <p>NIP. {user.nip || "................................"}</p>
            </div>
          </div>
        </article>

        <footer class="journal-report-footer" aria-hidden="true">
          <span>Rekap Kehadiran</span>
          <span class="journal-report-page-number" />
        </footer>
      </div>
    </Layout>
  );
}

attendanceReportRoutes.get("/app/attendance/report", async (c) => {
  const user = c.get("user");
  const [profile, schedules] = await Promise.all([
    getSchoolProfile(),
    listSchedulesByUser(user.id),
  ]);

  const options = buildReportOptions(schedules);
  const requestedOptionKey = c.req.query("classSubject")?.trim();
  const requestedScheduleId = Number(c.req.query("scheduleId"));
  const legacySchedule = schedules.find((schedule) => schedule.id === requestedScheduleId);
  const legacyOptionKey = legacySchedule
    ? attendanceReportOptionKey(legacySchedule.classId, legacySchedule.subject)
    : undefined;
  const selectedOption = options.find(
    (option) => option.key === (requestedOptionKey || legacyOptionKey),
  ) ?? options[0];

  const today = todayIso();
  const requestedDateFrom = c.req.query("dateFrom") ?? "";
  const requestedDateTo = c.req.query("dateTo") ?? "";
  const dateFrom = isIsoDate(requestedDateFrom) ? requestedDateFrom : `${today.slice(0, 7)}-01`;
  const dateTo = isIsoDate(requestedDateTo) ? requestedDateTo : today;
  const selectedClass = selectedOption
    ? schedules.find((schedule) => schedule.id === selectedOption.scheduleIds[0])?.class
    : undefined;
  const academicYear = c.req.query("academicYear")?.trim()
    || selectedClass?.academicYear
    || profile.defaultAcademicYear
    || defaultAcademicYear();
  const requestedSemester = c.req.query("semester");
  const semester: "1" | "2" = requestedSemester === "1" || requestedSemester === "2"
    ? requestedSemester
    : profile.defaultSemester;
  const recap = selectedOption && dateFrom <= dateTo
    ? await getAttendanceReportRecap(
        selectedOption.scheduleIds,
        selectedOption.classId,
        dateFrom,
        dateTo,
      )
    : null;
  return c.html(
    <AttendanceReportPage
      user={user}
      profile={profile}
      options={options}
      selectedOption={selectedOption}
      selectedOptionKey={selectedOption?.key}
      dateFrom={dateFrom}
      dateTo={dateTo}
      academicYear={academicYear}
      semester={semester}
      recap={recap}
    />
  );
});
