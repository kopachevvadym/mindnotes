import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
    </div>
  );
}

const navBase = "inline-flex items-center gap-1 underline-offset-4 transition-colors";
const navActive = "font-medium text-foreground";
const navIdle = "text-muted-foreground hover:text-foreground";

/**
 * Перемикач двох секцій (Сесії · Ідеї) — присутній на всіх маршрутах, тож із будь-якої
 * сторінки можна дістатися обох. На сторінці-деталі активна секція дістає ← — це й є
 * єдиний афорданс «назад» до її списку. Несткі, щоб не битися зі sticky-шапкою сесії.
 */
function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = pathname.startsWith("/ideas") ? "ideas" : "sessions";

  return (
    <nav className="flex items-center gap-3 pt-6 pb-1 font-sans text-sm">
      <Link to="/" className={cn(navBase, section === "sessions" ? navActive : navIdle)}>
        Сесії
      </Link>
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <Link to="/ideas" className={cn(navBase, section === "ideas" ? navActive : navIdle)}>
        Ідеї
      </Link>
    </nav>
  );
}
