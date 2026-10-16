import { HOT_SCORE } from "@/lib/types";

type DayPoint = { day: string; count: number };

export function ActivityChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <figure>
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={`${total} signaux sur 14 jours`}>
        {data.map((d, i) => {
          const isToday = i === data.length - 1;
          return (
            <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={`rounded-t-[2px] transition-colors ${isToday ? "bg-ink" : "bg-line-strong group-hover:bg-muted"}`}
                style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-[10px] text-paper tabular opacity-0 transition-opacity group-hover:opacity-100">
                {d.count}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-muted">
        <span>{new Date(data[0]?.day ?? "").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
        <span>aujourd&apos;hui</span>
      </figcaption>
    </figure>
  );
}

type Bucket = { bucket: number; count: number };

export function ScoreHistogram({ data }: { data: Bucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure>
      <div className="flex h-16 items-end gap-1" role="img" aria-label="Distribution des scores">
        {data.map((b) => {
          const isHot = b.bucket >= HOT_SCORE;
          const isWarm = b.bucket >= 50 && !isHot;
          const color = isHot ? "bg-signal" : isWarm ? "bg-warm/70" : "bg-line-strong";
          return (
            <div key={b.bucket} className="flex h-full flex-1 flex-col justify-end" title={`${b.bucket}–${b.bucket + 9} : ${b.count}`}>
              <div className={`rounded-t-[2px] ${color}`} style={{ height: `${Math.max(2, (b.count / max) * 100)}%` }} />
            </div>
          );
        })}
      </div>
      <figcaption className="relative mt-2 h-4 text-xs text-muted tabular">
        <span className="absolute left-0">0</span>
        <span className="absolute border-l border-signal pl-1 text-signal" style={{ left: `${HOT_SCORE}%` }}>
          chaud ≥ {HOT_SCORE}
        </span>
        <span className="absolute right-0">100</span>
      </figcaption>
    </figure>
  );
}
