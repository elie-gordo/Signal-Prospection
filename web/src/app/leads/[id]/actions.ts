"use server";

import { revalidatePath } from "next/cache";
import { repo } from "@/lib/data";
import { STATUSES, type LeadStatus } from "@/lib/types";

export type UpdateState = { ok: boolean; message: string } | null;

const MAX_NOTES = 4000;

export async function updateLeadAction(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  if (repo.readOnly) return { ok: false, message: "Démo en lecture seule : les modifications sont désactivées." };

  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "");

  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Lead invalide." };
  if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, message: "Statut invalide." };
  if (notes.length > MAX_NOTES) return { ok: false, message: `Notes trop longues (${MAX_NOTES} caractères max).` };

  try {
    await repo.updateLead(id, { status: status as LeadStatus, notes });
  } catch (error: unknown) {
    console.error("updateLeadAction failed", error);
    return { ok: false, message: "Enregistrement impossible, réessaie." };
  }

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  revalidatePath("/");
  return { ok: true, message: "Enregistré." };
}
