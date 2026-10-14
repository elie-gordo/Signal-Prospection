import Link from "next/link";
import { formatBudget, SIGNAL_LABEL, timeAgo } from "@/lib/labels";
import type { Lead } from "@/lib/types";
import { ScoreBadge, SourceTag, StatusPill } from "./LeadBits";

type Props = { lead: Lead; now: number; index?: number };

export function LeadRow({ lead, now, index = 0 }: Props) {
  const budget = formatBudget(lead.budgetMin, lead.budgetMax);
  const place = lead.company?.city;
  // first reason is the signal's base score; the most telling one is the best of the rest
  const topReason = lead.scoreReasons.slice(1).sort((a, b) => b.points - a.points)[0];
  const meta = [place, budget, topReason?.label, timeAgo(lead.publishedAt ?? lead.collectedAt, now)].filter(Boolean);

  return (
    <li className="rise" style={{ animationDelay: `${index * 35}ms` }}>
      <Link
        href={`/leads/${lead.id}`}
        className="group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line py-4 transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none sm:-mx-3 sm:px-3"
      >
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SourceTag source={lead.source} isCompact />
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{SIGNAL_LABEL[lead.signal]}</span>
            {lead.status !== "new" && <StatusPill status={lead.status} />}
          </div>
          <p className="truncate text-[15px] font-medium text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">
            {lead.title}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted">{meta.join(" · ")}</p>
        </div>
        <ScoreBadge score={lead.score} />
      </Link>
    </li>
  );
}
