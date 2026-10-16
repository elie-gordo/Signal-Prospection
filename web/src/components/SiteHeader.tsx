"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Tableau" },
  { href: "/leads", label: "Leads" },
  { href: "/methode", label: "Méthode" },
];

type Props = { isDemo: boolean };

export function SiteHeader({ isDemo }: Props) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-8 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm text-[15px] font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          <span aria-hidden className="h-2 w-2 rounded-full bg-signal" />
          Signal
        </Link>

        <nav aria-label="Navigation principale" className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className="rounded-md px-3 py-1.5 text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-paper aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {isDemo && (
          <span className="ml-auto hidden rounded-md border border-line px-2 py-0.5 text-xs text-muted sm:inline">
            Démo · données fictives
          </span>
        )}
      </div>
    </header>
  );
}
