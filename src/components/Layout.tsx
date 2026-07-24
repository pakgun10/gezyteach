import type { FC } from "hono/jsx";
import type { SessionUser } from "../services/auth.service";
import { Navbar } from "./Navbar";

type LayoutProps = {
  title: string;
  user?: SessionUser;
  activeNav?: string;
  children: any;
};

export const Layout: FC<LayoutProps> = ({
  title,
  user,
  activeNav,
  children,
}) => {
  return (
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} · GezyTeach</title>
        <link rel="stylesheet" href="/static/style.css" />
        <script src="/vendor/htmx.min.js" defer />
      </head>
      <body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        {user ? (
          <>
            <header class="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
              <span class="font-semibold text-lg text-emerald-700">
                GezyTeach
              </span>
              <span class="text-sm text-slate-500 truncate max-w-[45%]">
                {user.name}
              </span>
            </header>
            <main class="flex-1 px-4 py-4 pb-24 max-w-3xl w-full mx-auto">
              {children}
            </main>
            <Navbar active={activeNav} />
          </>
        ) : (
          <main class="flex-1 flex items-center justify-center px-4">
            {children}
          </main>
        )}
      </body>
    </html>
  );
};
