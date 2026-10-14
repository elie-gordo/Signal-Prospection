"use client";

import { useActionState } from "react";
import { STATUS_LABEL } from "@/lib/labels";
import { STATUSES, type LeadStatus } from "@/lib/types";
import { updateLeadAction } from "./actions";

type Props = { id: number; status: LeadStatus; notes: string | null; isReadOnly: boolean };

export function StatusForm({ id, status, notes, isReadOnly }: Props) {
  const [state, formAction, isPending] = useActionState(updateLeadAction, null);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      <fieldset disabled={isReadOnly || isPending} className="space-y-5 disabled:opacity-70">
        <legend className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Pipeline</legend>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="radio" name="status" value={s} defaultChecked={s === status} className="peer sr-only" />
              <span className="inline-block rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal">
                {STATUS_LABEL[s]}
              </span>
            </label>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Notes</span>
          <textarea
            name="notes"
            defaultValue={notes ?? ""}
            rows={5}
            maxLength={4000}
            placeholder="Contexte, angle d'approche, prochaine relance…"
            className="w-full resize-y rounded-md border border-line bg-surface p-3 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal"
          />
        </label>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="h-10 rounded-md bg-ink px-5 text-sm font-medium text-paper transition-transform hover:-translate-y-px active:translate-y-0 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <p aria-live="polite" className={`text-sm ${state?.ok ? "text-cool" : "text-signal"}`}>
            {state?.message}
          </p>
        </div>
      </fieldset>
      {isReadOnly && <p className="text-xs text-muted">Mode démo : le pipeline est en lecture seule.</p>}
    </form>
  );
}
