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
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-4 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2 focus-visible:outline-none">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-signal opacity-40 motion-reduce:hidden" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-signal" />
          </span>
          <span className="font-display text-2xl italic leading-none tracking-tight group-focus-visible:underline">Signal</span>
        </Link>

        <nav aria-label="Navigation principale" className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className="rounded-full px-3 py-1.5 text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal aria-[current=page]:bg-ink aria-[current=page]:text-paper"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {isDemo && (
          <span className="ml-auto hidden rounded-full border border-dashed border-line-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted sm:inline">
            Démo · données fictives
          </span>
        )}
      </div>
    </header>
  );
}
