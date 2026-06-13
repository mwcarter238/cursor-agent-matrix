import type { WorkflowMode } from "../api/types";

export interface WorkflowMeta {
  mode: WorkflowMode;
  title: string;
  short: string;
  verb: string; // action button label
  blurb: string;
  accent: string; // accent colour for the workflow
  glyph: string; // inline SVG path data
  /** How the quantity field is framed for this workflow. */
  quantityLabel: string;
}

export const WORKFLOWS: Record<WorkflowMode, WorkflowMeta> = {
  receive: {
    mode: "receive",
    title: "Receiving",
    short: "Receive",
    verb: "Add to inventory",
    blurb: "Scan incoming stock to add it to inventory.",
    accent: "#2f6bff",
    quantityLabel: "Quantity received",
    glyph: "M12 3v12m0 0 4-4m-4 4-4-4M5 21h14",
  },
  dispense: {
    mode: "dispense",
    title: "Dispense",
    short: "Dispense",
    verb: "Dispense to patient",
    blurb: "Scan product as it is dispensed to a patient.",
    accent: "#2ee6a6",
    quantityLabel: "Quantity dispensed",
    glyph: "M12 21V9m0 0 4 4m-4-4-4 4M5 3h14",
  },
  "cycle-count": {
    mode: "cycle-count",
    title: "Cycle Count",
    short: "Count",
    verb: "Set counted quantity",
    blurb: "Scan to reconcile what is physically on the shelf.",
    accent: "#57e0ff",
    quantityLabel: "Counted quantity",
    glyph: "M9 11l3 3 8-8M21 12a9 9 0 1 1-6.2-8.5",
  },
};

export const WORKFLOW_ORDER: WorkflowMode[] = ["receive", "dispense", "cycle-count"];
