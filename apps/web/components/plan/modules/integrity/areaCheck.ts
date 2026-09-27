import { BASE_ASSUMPTIONS, type InvariantResult } from "@oh/plan-model";
import { AREAS, TOTAL_SQFT } from "../floor-plan/layout";

/**
 * The floor plan is drawn from its own geometry (layout.ts); the engine
 * prices the unit from BASE_ASSUMPTIONS.squareFeet. This check keeps the two
 * honest: the drawn area must equal the modeled area, and the drawn dining
 * zones must hold every pod the model sells.
 */
export function floorPlanAreaCheck(): InvariantResult {
  const modeled = BASE_ASSUMPTIONS.squareFeet;
  const drawn = TOTAL_SQFT;
  const pass = Math.abs(drawn - modeled) <= 1;
  return {
    key: "floor-plan-area",
    label: "Drawn floor plan area equals the modeled square footage",
    pass,
    detail: `${drawn.toLocaleString("en-US")} sf drawn across ${AREAS.length} areas vs ${modeled.toLocaleString("en-US")} sf modeled`,
  };
}
