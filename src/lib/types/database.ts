import { z } from "zod";

// ─── Criteria Table Row ───────────────────────────────────────────
export const CriteriaRowSchema = z.object({
  id: z.number().int(),
  description: z.string(),
  category: z.enum(["Adult", "Pediatric", "Geriatric"]),
  age_min: z.number().int().min(0),
  age_max: z.number().int().min(0).nullable(),
  activation_level: z.enum(["Level 1", "Level 2", "Level 3"]),
  notes: z.string().nullable(),
});

export type CriteriaRow = z.infer<typeof CriteriaRowSchema>;

// ─── Examples Table Row ───────────────────────────────────────────
export const ExampleRowSchema = z.object({
  id: z.number().int(),
  criteria_id: z.number().int().nullable(),
  mechanism: z.string(),
  descriptors: z.string().nullable(),
  age: z.number().int(),
  gender: z.enum(["male", "female"]).nullable(),
  gcs: z.number().int().nullable(),
  systolic_bp: z.number().int().nullable(),
  heart_rate: z.number().int().nullable(),
  respiratory_rate: z.number().int().nullable(),
  airway: z.enum(["patent", "intubated", "extraglottic", "compromised"]).nullable(),
  breathing: z.enum(["Breathing Independently", "Bagging", "Ventilator"]).nullable(),
  oxygen_saturation: z.number().int().nullable(),
  pregnancy_in_weeks: z.number().int().nullable(),
});

export type ExampleRow = z.infer<typeof ExampleRowSchema>;

// ─── Example with joined criterion description ────────────────────
export const ExampleWithCriterionSchema = ExampleRowSchema.extend({
  criteria: z
    .object({
      description: z.string(),
    })
    .nullable(),
});

export type ExampleWithCriterion = z.infer<typeof ExampleWithCriterionSchema>;

// ─── Filter Schemas (for URL param parsing) ───────────────────────

export const CriteriaFiltersSchema = z.object({
  levels: z.array(z.enum(["Level 1", "Level 2", "Level 3"])).default([]),
  categories: z.array(z.enum(["Adult", "Pediatric", "Geriatric"])).default([]),
  age: z.number().int().min(0).nullable().default(null),
  search: z.string().default(""),
});

export type CriteriaFilters = z.infer<typeof CriteriaFiltersSchema>;

export type NullFilterState = "all" | "has_value" | "is_empty";

export const ExamplesFiltersSchema = z.object({
  gcs: z.tuple([z.number(), z.number()]).nullable().default(null),
  sbp: z.tuple([z.number(), z.number()]).nullable().default(null),
  hr: z.tuple([z.number(), z.number()]).nullable().default(null),
  rr: z.tuple([z.number(), z.number()]).nullable().default(null),
  spo2: z.tuple([z.number(), z.number()]).nullable().default(null),
  airway: z.string().default(""),
  breathing: z.string().default(""),
  search: z.string().default(""),
});

export type ExamplesFilters = z.infer<typeof ExamplesFiltersSchema>;
