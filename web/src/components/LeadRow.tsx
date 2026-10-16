import Link from "next/link";
import { formatBudget, SIGNAL_LABEL, timeAgo } from "@/lib/labels";
import type { Lead } from "@/lib/types";
import { ScoreBadge, SourceTag, StatusPill } from "./LeadBits";

type Props = { lead: Lead; now: number };

export function LeadRow({ lead, now }: Props) {
  const budget = formatBudget(lead.budgetMin, lead.budgetMax);
  const place = lead.company?.city;
  // first reason is the signal's base score; the most telling one is the best of the rest
  const topReason = lead.scoreReasons.slice(1).sort((a, b) => b.points - a.points)[0];
  const meta = [place, budget, topReason?.label, timeAgo(lead.publishedAt ?? lead.collectedAt, now)].filter(Boolean);

  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/leads/${lead.id}`}
        className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
      >
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <SourceTag source={lead.source} isCompact />
            <span className="text-xs text-muted">{SIGNAL_LABEL[lead.signal]}</span>
            {lead.status !== "new" && <StatusPill status={lead.status} />}
          </div>
          <p className="truncate text-sm font-medium text-ink">{lead.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">{meta.join(" · ")}</p>
        </div>
        <ScoreBadge score={lead.score} />
      </Link>
    </li>
  );
}
