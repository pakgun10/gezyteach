import type { FC } from "hono/jsx";

const NAV_ITEMS = [
  { key: "dashboard", label: "Beranda", href: "/app", icon: "🏠" },
  { key: "schedule", label: "Jadwal", href: "/app/schedule", icon: "🗓️" },
  { key: "journal", label: "Jurnal", href: "/app/journal", icon: "📝" },
  { key: "attendance", label: "Absensi", href: "/app/attendance", icon: "✅" },
  { key: "students", label: "Siswa", href: "/app/students", icon: "🎓" },
  { key: "scores", label: "Nilai", href: "/app/scores", icon: "📊" },
  {
    key: "resources",
    label: "Perangkat",
    href: "/app/resources",
    icon: "📁",
  },
];

export const Navbar: FC<{ active?: string }> = ({ active }) => {
  return (
    <nav class="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-10">
      <ul class="flex overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map((item) => (
          <li class="flex-1 min-w-[64px]">
            <a
              href={item.href}
              class={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
                active === item.key
                  ? "text-emerald-700 font-medium"
                  : "text-slate-500"
              }`}
            >
              <span class="text-lg leading-none">{item.icon}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
