import "server-only";
import type { LeadRepository } from "../types";
import { demoRepo } from "./demo";
import { DEMO_NOW } from "./fixtures";
import { postgresRepo } from "./postgres";

export const isDemo = process.env.DATA_SOURCE === "demo";

export const repo: LeadRepository = isDemo ? demoRepo : postgresRepo;

// Demo data is frozen in time; relative dates are computed against its own clock.
export const referenceNow = (): number => (isDemo ? DEMO_NOW : Date.now());
