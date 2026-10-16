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
        <legend className="mb-3 text-base font-semibold">Pipeline</legend>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="radio" name="status" value={s} defaultChecked={s === status} className="peer sr-only" />
              <span className="inline-block rounded-md border border-line px-2.5 py-1 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                {STATUS_LABEL[s]}
              </span>
            </label>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Notes</span>
          <textarea
            name="notes"
            defaultValue={notes ?? ""}
            rows={5}
            maxLength={4000}
            placeholder="Contexte, angle d'approche, prochaine relance…"
            className="w-full resize-y rounded-md border border-line bg-surface p-3 text-sm placeholder:text-muted focus-visible:border-ink focus-visible:outline-none"
          />
        </label>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="h-9 rounded-md bg-ink px-4 text-sm font-medium text-paper transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
