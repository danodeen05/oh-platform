import type { ComponentType } from "react";
import type { SectionKey } from "@/lib/plan/sections";
import { ModelPrint } from "./model/ModelPrint";

/**
 * Print variants by section. Only the print route imports this, so the
 * interactive pages never pull in modules they do not render (see
 * lib/plan/sections.ts on why the registry itself is metadata-only).
 */
export const PRINT_MODULES: Partial<Record<SectionKey, ComponentType<{ locale: string }>>> = {
  model: ModelPrint,
};
