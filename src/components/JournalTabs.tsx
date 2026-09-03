import type { FC } from "hono/jsx";

type JournalTab = "teaching" | "report" | "anecdotal";

export const JournalTabs: FC<{ active: JournalTab }> = ({ active }) => {
  const tabClass = "inline-flex items-center px-3 py-2 whitespace-nowrap";
  return (
    <div class="flex gap-2 mb-5 text-sm overflow-x-auto no-scrollbar">
      <a
        href="/app/journal"
        class={`${tabClass} ${active === "teaching" ? "gt-btn-primary" : "gt-btn-secondary"}`}
      >
        Jurnal Mengajar
      </a>
      <a
        href="/app/journal/report"
        class={`${tabClass} ${active === "report" ? "gt-btn-primary" : "gt-btn-secondary"}`}
      >
        Print Laporan Jurnal
      </a>
      <a
        href="/app/journal/anecdotal"
        class={`${tabClass} ${active === "anecdotal" ? "gt-btn-primary" : "gt-btn-secondary"}`}
      >
        Anecdotal Record
      </a>
    </div>
  );
};

