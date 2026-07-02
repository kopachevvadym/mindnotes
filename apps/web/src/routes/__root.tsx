import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { SearchPalette } from "@/components/search/SearchPalette";
import { cn } from "@/lib/utils";

export const Route = createRootRoute({
  component: RootLayout,
});

/**
 * Спільний каркас УСІХ маршрутів: однакова ширина (max-w-reading) + горизонтальні
 * падінги, і спільна навігація зверху. Вміст сторінок рендериться в <Outlet/>.
 */
function RootLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-reading flex-col px-5">
        <AppNav />
        <Outlet />
      </div>
      <SearchPalette />
    </div>
  );
}

const navBase = "inline-flex items-center gap-1 underline-offset-4 transition-colors";
const navActive = "font-medium text-foreground";
const navIdle = "text-muted-foreground hover:text-foreground";

/**
 * Перемикач двох секцій (Сесії · Ідеї) — присутній на всіх маршрутах, тож із будь-якої
 * сторінки можна дістатися обох. На сторінці-деталі лінк активної секції веде до її
 * списку — це і є афорданс «назад». Нестикі, щоб не битися зі sticky-шапкою сесії.
 */
function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = pathname.startsWith("/contexts") ? "contexts" : "sessions";

  return (
    <nav className="flex items-center gap-3 pt-6 pb-1 font-sans text-sm">
      <Link to="/" className={cn(navBase, section === "sessions" ? navActive : navIdle)}>
        Сесії
      </Link>
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <Link to="/contexts" className={cn(navBase, section === "contexts" ? navActive : navIdle)}>
        Ідеї
      </Link>
    </nav>
  );
}
