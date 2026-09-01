import type { FC } from "hono/jsx";

type AttendanceTab = "students" | "history" | "recap";

const TABS: Array<{ key: AttendanceTab; label: string; href: string }> = [
  { key: "students", label: "Absensi Siswa", href: "/app/attendance" },
  {
    key: "history",
    label: "Pelaksanaan",
    href: "/app/attendance/history",
  },
  { key: "recap", label: "Rekap", href: "/app/attendance/recap" },
];

export const AttendanceTabs: FC<{ active: AttendanceTab }> = ({ active }) => {
  const tabClass = "inline-flex items-center px-3 py-2 whitespace-nowrap";

  return (
    <div class="flex gap-2 mb-5 text-sm overflow-x-auto no-scrollbar">
      {TABS.map((tab) => (
        <a
          href={tab.href}
          class={`${tabClass} ${active === tab.key ? "gt-btn-primary" : "gt-btn-secondary"}`}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
};
