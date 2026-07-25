import type { FC } from "hono/jsx";
import type { SessionStudent } from "../services/student-auth.service";
import { ThemeInitScript, ThemeToggle } from "./ThemeToggle";

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
        <ThemeInitScript />
        <link rel="stylesheet" href="/static/style.css" />
        <script src="/vendor/htmx.min.js" defer />
      </head>
      <body class="gt-transition min-h-screen flex flex-col">
        <header class="gt-header-glass sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
          <span class="gt-accent-text font-semibold text-lg">
            GezyTeach Siswa
          </span>
          <div class="flex items-center gap-3">
            <ThemeToggle />
            <span class="gt-muted text-sm truncate max-w-[35%]">
              {student.name}
            </span>
          </div>
        </header>
        <main class="flex-1 px-4 py-4 pb-24 max-w-3xl w-full mx-auto">
          {children}
        </main>
        <nav class="gt-nav-glass fixed bottom-0 inset-x-0 z-10">
          <ul class="flex overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => (
              <li class="flex-1 min-w-16">
                <a
                  href={item.href}
                  class={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors ${
                    activeNav === item.key
                      ? "gt-accent-text font-medium"
                      : "gt-muted"
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
