"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  ScanLine,
  Boxes,
  BookOpen,
  QrCode,
  CalendarClock,
  PackageCheck,
  ShieldCheck,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { canAccessAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/register", label: "Sales Register", icon: ScanLine, mobile: true },
  { href: "/sales", label: "Sales", icon: Receipt, mobile: false },
  { href: "/analytics", label: "Analytics", icon: BarChart3, mobile: false },
  { href: "/inventory", label: "Inventory", icon: Boxes, mobile: true },
  { href: "/reservations", label: "Reservations", icon: CalendarClock, mobile: false },
  { href: "/batch-sales", label: "Batch Sales", icon: PackageCheck, mobile: false },
  { href: "/catalog", label: "Catalog", icon: BookOpen, mobile: false },
  { href: "/labels", label: "Price Labels", icon: QrCode, mobile: false },
  { href: "/admin", label: "Admin", icon: ShieldCheck, mobile: false, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, mobile: true },
];

/** Nav items visible to the given role. */
function visibleNav(role: UserRole | undefined) {
  return nav.filter((item) => !item.adminOnly || (role && canAccessAdmin(role)));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useSession();
  const { theme, toggleTheme } = useTheme();

  // Auth guard: bounce to login if not signed in.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-ink-faint">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-surface-border bg-surface md:flex">
        <div className="p-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {visibleNav(user.role).map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-800"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-surface-border p-3">
          <div className="mb-2 px-2">
            <div className="text-sm font-medium text-ink">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-xs text-ink-faint capitalize">
              {user.role.toLowerCase()}
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-surface-border bg-surface px-4 py-3 md:hidden">
          <Logo />
          <button
            onClick={logout}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile bottom nav — core items only */}
        <nav className="order-last flex border-t border-surface-border bg-surface md:hidden">
          {nav.filter((i) => i.mobile).map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-brand-700" : "text-ink-faint"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
