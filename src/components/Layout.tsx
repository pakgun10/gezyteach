import type { FC } from "hono/jsx";
import type { SessionUser } from "../services/auth.service";
import { Navbar } from "./Navbar";
import { ThemeInitScript, ThemeToggle } from "./ThemeToggle";

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
        <ThemeInitScript />
        <link rel="stylesheet" href="/static/style.css" />
        <script src="/vendor/htmx.min.js" defer />
      </head>
      <body class="gt-transition min-h-screen flex flex-col">
        {user ? (
          <>
            <header class="gt-header-glass sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
              <span class="gt-accent-text font-semibold text-lg">
                GezyTeach
              </span>
              <div class="flex items-center gap-3">
                <ThemeToggle />
                <a
                  href="/app/profile"
                  class="gt-link-muted text-sm truncate max-w-[35%]"
                >
                  {user.name}
                </a>
              </div>
            </header>
            <main class="flex-1 px-4 py-4 pb-24 max-w-3xl w-full mx-auto">
              {children}
            </main>
            <Navbar active={activeNav} />
          </>
        ) : (
          <main class="flex-1 flex items-center justify-center px-4 relative">
            <div class="absolute top-4 right-4">
              <ThemeToggle />
            </div>
            {children}
          </main>
        )}
      </body>
    </html>
  );
};
