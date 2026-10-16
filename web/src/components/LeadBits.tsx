import { SOURCE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { HOT_SCORE, type LeadStatus, type Source } from "@/lib/types";

export function SourceTag({ source, isCompact = false }: { source: Source; isCompact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-soft">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--src-${source})` }} />
      {isCompact ? SOURCE_LABEL[source].split(" ")[0] : SOURCE_LABEL[source]}
    </span>
  );
}

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "border-line text-ink-soft",
  qualified: "border-warm/30 bg-warm/10 text-warm",
  contacted: "border-ink/15 bg-ink/5 text-ink",
  replied: "border-signal/30 bg-signal/10 text-signal",
  won: "border-cool/30 bg-cool/10 text-cool",
  lost: "border-line text-muted line-through",
  ignored: "border-line text-muted",
};

export function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex rounded-md border px-1.5 py-px text-[11px] font-medium ${STATUS_STYLE[status]}`}>
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
        <span className="text-xs text-muted">Score</span>
        <span className={`text-5xl font-semibold leading-none tracking-tight tabular ${tone}`}>{score}</span>
        <span className="h-1 w-20 overflow-hidden rounded-full bg-line">
          <span className={`block h-full ${bar}`} style={{ width: `${score}%` }} />
        </span>
      </div>
    );
  }

  return (
    <span className="inline-flex w-12 flex-col items-end gap-1" aria-label={`Score ${score} sur 100`}>
      <span className={`text-base font-semibold leading-none tabular ${tone}`}>{score}</span>
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-line">
        <span className={`block h-full ${bar}`} style={{ width: `${score}%` }} />
      </span>
    </span>
  );
}
