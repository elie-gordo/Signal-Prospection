import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { HOT_SCORE, type LeadStatus, type Source } from "@/lib/types";

export function SourceTag({ source, isCompact = false }: { source: Source; isCompact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-soft">
      <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: `var(--src-${source})` }} />
      {isCompact ? SOURCE_LABEL[source].split(" ")[0] : SOURCE_LABEL[source]}
    </span>
  );
}

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "border-line-strong text-ink-soft",
  qualified: "border-warm text-warm",
  contacted: "border-ink bg-ink text-paper",
  replied: "border-signal bg-signal text-paper",
  won: "border-cool bg-cool text-paper",
  lost: "border-line text-muted line-through",
  ignored: "border-line text-muted",
};

export function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "md" | "lg" }) {
  const isHot = score >= HOT_SCORE;
  const isWarm = score >= 50 && !isHot;
  const tone = isHot ? "text-signal" : isWarm ? "text-warm" : "text-muted";
  const bar = isHot ? "bg-signal" : isWarm ? "bg-warm" : "bg-line-strong";

  if (size === "lg") {
    return (
      <div className="flex flex-col items-end gap-2" aria-label={`Score ${score} sur 100`}>
        <span className={`font-display text-7xl leading-none tabular ${tone}`}>{score}</span>
        <span className="h-1 w-24 overflow-hidden rounded-full bg-line">
          <span className={`block h-full ${bar}`} style={{ width: `${score}%` }} />
        </span>
      </div>
    );
  }

  return (
    <span className="inline-flex w-14 flex-col items-end gap-1" aria-label={`Score ${score} sur 100`}>
      <span className={`font-mono text-lg font-semibold leading-none tabular ${tone}`}>{score}</span>
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-line">
        <span className={`block h-full ${bar}`} style={{ width: `${score}%` }} />
      </span>
    </span>
  );
}
