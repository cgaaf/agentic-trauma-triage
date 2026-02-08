import type { ExtractedFields, PlausibilityWarning, CriterionMatch } from "$lib/types/index.js";

// ─── Extracted Fields Variants ─────────────────────────────────────

export const allFieldsPresent: ExtractedFields = {
  age: 34,
  sbp: 88,
  hr: 125,
  rr: 28,
  gcs: 12,
  airwayStatus: "Patent, maintained with jaw thrust",
  breathingStatus: "Tachypneic, decreased breath sounds on left",
  mechanism: "High-speed MVC with rollover, unrestrained driver",
  injuries: ["Left femur fracture", "Left-sided flail chest", "Scalp laceration"],
  additionalContext: "Patient was found 15 feet from vehicle",
};

export const partialFields: ExtractedFields = {
  age: 72,
  sbp: 102,
  hr: 98,
  rr: null,
  gcs: null,
  airwayStatus: "Intact",
  breathingStatus: null,
  mechanism: "Ground-level fall",
  injuries: ["Hip pain"],
  additionalContext: null,
};

export const minimalFields: ExtractedFields = {
  age: 8,
  sbp: null,
  hr: null,
  rr: null,
  gcs: null,
  airwayStatus: null,
  breathingStatus: null,
  mechanism: null,
  injuries: null,
  additionalContext: null,
};

// ─── Plausibility Warnings ─────────────────────────────────────────

export const sampleWarnings: PlausibilityWarning[] = [
  {
    field: "sbp",
    value: 240,
    message: "SBP of 240 mmHg is unusually high — verify reading",
  },
  {
    field: "hr",
    value: 210,
    message: "HR of 210 bpm exceeds expected range for age — verify reading",
  },
];

// ─── Criterion Matches ─────────────────────────────────────────────

export const level1Deterministic: CriterionMatch = {
  criterionId: 1,
  description: "GCS ≤ 8 (Adult)",
  activationLevel: "Level 1",
  category: "Adult",
  ageRangeLabel: "≥15 years",
  source: "deterministic",
  triggerReason: "GCS score of 6 is ≤ 8",
};

export const level1Llm: CriterionMatch = {
  criterionId: 45,
  description: "Penetrating injury to head, neck, torso, or proximal extremities",
  activationLevel: "Level 1",
  category: "Adult",
  ageRangeLabel: "≥15 years",
  source: "llm",
  confidence: 0.92,
  triggerReason: "Report describes gunshot wound to the abdomen",
};

export const level2Match: CriterionMatch = {
  criterionId: 78,
  description: "Two or more proximal long-bone fractures",
  activationLevel: "Level 2",
  category: "Adult",
  ageRangeLabel: "≥15 years",
  source: "deterministic",
  triggerReason: "Bilateral femur fractures identified",
};

export const level3Match: CriterionMatch = {
  criterionId: 110,
  description: "Ground-level fall in patient ≥65 years on anticoagulants",
  activationLevel: "Level 3",
  category: "Geriatric",
  ageRangeLabel: "≥65 years",
  source: "llm",
  confidence: 0.85,
  triggerReason: "Patient is 72 years old, on warfarin, ground-level fall",
};

export const pediatricMatch: CriterionMatch = {
  criterionId: 130,
  description: "Pediatric patient with GCS ≤ 12",
  activationLevel: "Level 1",
  category: "Pediatric",
  ageRangeLabel: "<15 years",
  source: "deterministic",
  triggerReason: "GCS score of 10 in 8-year-old patient",
};

export const pediatricLevel2: CriterionMatch = {
  criterionId: 135,
  description: "Bicycle vs. automobile collision (Pediatric)",
  activationLevel: "Level 2",
  category: "Pediatric",
  ageRangeLabel: "<15 years",
  source: "llm",
  confidence: 0.88,
  triggerReason: "Child struck by car while riding bicycle",
};

// ─── Composite Match Arrays ─────────────────────────────────────────

export const singleLevel1Matches: CriterionMatch[] = [level1Deterministic];

export const mixedLevelMatches: CriterionMatch[] = [
  level1Deterministic,
  level1Llm,
  level2Match,
  level3Match,
];

export const pediatricMatches: CriterionMatch[] = [pediatricMatch, pediatricLevel2];

export const llmConfidenceMatches: CriterionMatch[] = [
  level1Llm,
  {
    criterionId: 50,
    description: "Suspected spinal cord injury with motor deficit",
    activationLevel: "Level 1",
    category: "Adult",
    ageRangeLabel: "≥15 years",
    source: "llm",
    confidence: 0.78,
    triggerReason: "Loss of sensation below T10 with bilateral leg weakness",
  },
  {
    criterionId: 95,
    description: "Crush injury to torso or extremity with ischemia",
    activationLevel: "Level 2",
    category: "Adult",
    ageRangeLabel: "≥15 years",
    source: "llm",
    confidence: 0.65,
    triggerReason: "Prolonged entrapment under machinery, right leg pulseless",
  },
];

// ─── Text Fixtures ──────────────────────────────────────────────────

export const level1Justification =
  "Patient meets Level 1 trauma activation criteria: GCS ≤ 8 indicating severe traumatic brain injury, combined with penetrating abdominal wound. Immediate full trauma team activation recommended.";

export const level2Justification =
  "Patient meets Level 2 trauma activation criteria: bilateral proximal long-bone fractures indicating high-energy mechanism. Priority trauma team response recommended.";

export const level3Justification =
  "Patient meets Level 3 trauma activation criteria: elderly patient on anticoagulants with ground-level fall and hip injury. Trauma consultation recommended.";

export const standardTriageJustification =
  "No trauma activation criteria met. Patient may be evaluated through standard triage protocols.";

export const sampleReasoning = `Extraction phase identified a 34-year-old male involved in a high-speed MVC with rollover. Patient was unrestrained and found 15 feet from vehicle, suggesting ejection.

Vital signs: SBP 88 (hypotensive), HR 125 (tachycardic), RR 28 (tachypneic), GCS 12 (moderate TBI).

Deterministic evaluation triggered Level 1 for SBP < 90 and Level 2 for GCS 9-12 range.

LLM evaluation identified additional criteria: penetrating mechanism not applicable, but high-energy mechanism with ejection meets Level 1 criteria (criterion #42). Flail chest with respiratory compromise also flags Level 1 (criterion #15, confidence 0.91).

Final determination: Level 1 activation based on hemodynamic instability (SBP < 90), high-energy mechanism with ejection, and flail chest. Multiple Level 1 criteria corroborate the highest activation level.`;

export const sampleReport = `34-year-old male, high-speed MVC with rollover on I-85. Patient was unrestrained driver, found approximately 15 feet from vehicle suggesting partial ejection.

Vitals on scene: BP 88/62, HR 125, RR 28, GCS 12 (E3V4M5). SpO2 92% on 15L NRB.

Airway patent, maintained with jaw thrust. Decreased breath sounds on left with paradoxical chest wall movement consistent with flail segment. Left femur angulated and shortened. Large scalp laceration with active bleeding controlled with pressure dressing.

IV access x2 established, 500mL NS bolus initiated. C-collar applied, boarded. ETA 8 minutes.`;

// ─── Composite Story Scenario Data ──────────────────────────────────

export const geriatricFields: ExtractedFields = {
  age: 72,
  sbp: 102,
  hr: 98,
  rr: 18,
  gcs: 14,
  airwayStatus: "Intact",
  breathingStatus: "Normal rate, clear bilaterally",
  mechanism: "Ground-level fall from standing",
  injuries: ["Right hip pain and deformity", "Occipital scalp hematoma"],
  additionalContext: "Patient on warfarin for atrial fibrillation, INR last checked at 2.8",
};

export const pediatricFields: ExtractedFields = {
  age: 8,
  sbp: 84,
  hr: 145,
  rr: 32,
  gcs: 10,
  airwayStatus: "Patent, crying",
  breathingStatus: "Tachypneic, splinting on left",
  mechanism: "Bicycle vs. automobile, child struck at approximately 30 mph",
  injuries: ["Left femur deformity", "Abdominal guarding", "Left forearm swelling"],
  additionalContext: "Helmeted, found 10 feet from bicycle",
};

export const standardTriageFields: ExtractedFields = {
  age: 28,
  sbp: 122,
  hr: 82,
  rr: 16,
  gcs: 15,
  airwayStatus: "Patent",
  breathingStatus: "Normal, clear bilaterally",
  mechanism: "Tripped on curb, fell onto outstretched hand",
  injuries: ["3 cm laceration to right forearm"],
  additionalContext: "No LOC, ambulatory on scene",
};

export const geriatricLevel2Match: CriterionMatch = {
  criterionId: 105,
  description: "Hip fracture in patient ≥65 years",
  activationLevel: "Level 2",
  category: "Geriatric",
  ageRangeLabel: "≥65 years",
  source: "llm",
  confidence: 0.91,
  triggerReason: "Right hip pain with deformity in 72-year-old patient",
};

export const geriatricLevel3Anticoag: CriterionMatch = {
  criterionId: 110,
  description: "Ground-level fall in patient ≥65 years on anticoagulants",
  activationLevel: "Level 3",
  category: "Geriatric",
  ageRangeLabel: "≥65 years",
  source: "llm",
  confidence: 0.95,
  triggerReason:
    "Patient is 72 years old, on warfarin (INR 2.8), ground-level fall with head strike",
};

export const geriatricReport = `72-year-old female, ground-level fall from standing at home. Patient tripped on rug and fell, striking head on hardwood floor.

Vitals on scene: BP 102/68, HR 98, RR 18, GCS 14 (E4V4M6). SpO2 97% on RA.

Right hip pain with external rotation and shortening. Occipital scalp hematoma, no active bleeding. Patient on warfarin for AFib, last INR 2.8 per family.

C-collar applied as precaution. IV access established. ETA 12 minutes.`;

export const pediatricReport = `8-year-old male, bicycle vs. automobile collision on residential street. Child was riding bicycle and struck by sedan traveling approximately 30 mph.

Vitals on scene: BP 84/56, HR 145, RR 32, GCS 10 (E3V3M4). SpO2 94% on NRB.

Helmeted. Left femur angulated mid-shaft. Abdomen distended with guarding in LUQ. Left forearm swollen, neurovascularly intact distally. Found approximately 10 feet from bicycle.

IV access x1 established, 20mL/kg NS bolus initiated. C-collar applied, boarded. ETA 6 minutes.`;

export const standardTriageReport = `28-year-old male, tripped on curb while walking and fell onto outstretched right hand. No LOC, ambulatory on scene.

Vitals: BP 122/78, HR 82, RR 16, GCS 15. SpO2 99% on RA.

3 cm laceration to right volar forearm, controlled with direct pressure. No neurovascular deficit. No other injuries identified. Patient ambulating without difficulty.

Wound dressed. ETA 15 minutes to ED, non-emergent transport.`;

export const pediatricJustification =
  "Patient meets Level 1 trauma activation criteria: pediatric patient (8 years) with GCS ≤ 12, hypotension for age (SBP 84), and high-energy mechanism (bicycle vs. automobile). Immediate pediatric trauma team activation recommended.";

export const geriatricJustification =
  "Patient meets Level 2 trauma activation criteria: geriatric patient (72 years) with hip fracture and anticoagulant use. Head strike on warfarin requires close monitoring. Priority trauma team response with geriatric consultation recommended.";

export const sampleMissingFieldWarnings: string[] = [
  "Respiratory rate (RR) could not be extracted — vital sign threshold criteria may be incomplete",
  "GCS score could not be extracted — neurological criteria may be incomplete",
];
