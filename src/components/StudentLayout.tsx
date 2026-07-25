import type { FC } from "hono/jsx";
import type { SessionStudent } from "../services/student-auth.service";

const NAV_ITEMS = [
  { key: "dashboard", label: "Beranda", href: "/siswa", icon: "🏠" },
  { key: "attendance", label: "Absensi", href: "/siswa/absensi", icon: "✅" },
  { key: "scores", label: "Nilai", href: "/siswa/nilai", icon: "📊" },
  { key: "profile", label: "Profil", href: "/siswa/profil", icon: "👤" },
];

type StudentLayoutProps = {
  title: string;
  student: SessionStudent;
  activeNav?: string;
  children: any;
};

export const StudentLayout: FC<StudentLayoutProps> = ({
  title,
  student,
  activeNav,
  children,
}) => {
  return (
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} · GezyTeach Siswa</title>
        <link rel="stylesheet" href="/static/style.css" />
        <script src="/vendor/htmx.min.js" defer />
      </head>
      <body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        <header class="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
          <span class="font-semibold text-lg text-emerald-700">
            GezyTeach Siswa
          </span>
          <span class="text-sm text-slate-500 truncate max-w-[45%]">
            {student.name}
          </span>
        </header>
        <main class="flex-1 px-4 py-4 pb-24 max-w-3xl w-full mx-auto">
          {children}
        </main>
        <nav class="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-10">
          <ul class="flex overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => (
              <li class="flex-1 min-w-[64px]">
                <a
                  href={item.href}
                  class={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
                    activeNav === item.key
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
      </body>
    </html>
  );
};
