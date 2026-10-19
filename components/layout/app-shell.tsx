"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  HandCoins,
  Landmark,
  LayoutDashboard,
  PieChart,
  FileDown,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/accounting", label: "Accounts", icon: Landmark },
  { href: "/donors", label: "Donors", icon: Users },
  { href: "/donations", label: "Gifts", icon: HandCoins },
  { href: "/expenses", label: "Pay", icon: Banknote },
  { href: "/budgets", label: "Budget", icon: PieChart },
  { href: "/audit", label: "Audit", icon: FileDown },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-5">
          <Image
            src="/assets/trust-logo.png"
            alt="Trust logo"
            width={40}
            height={40}
            className="rounded-full"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              BNST Trust Portal
            </p>
            <p className="text-xs text-muted-foreground">Admin & FAS</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <Image
            src="/assets/trust-logo.png"
            alt="Trust logo"
            width={36}
            height={36}
            className="rounded-full"
            priority
          />
          <div>
            <p className="text-sm font-semibold">BNST Trust Portal</p>
            <p className="text-xs text-muted-foreground">FY 2026-27</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 md:px-8 md:py-8 md:pb-8">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur md:hidden"
          aria-label="Primary"
        >
          <ul className="grid grid-cols-4 sm:grid-cols-7">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
