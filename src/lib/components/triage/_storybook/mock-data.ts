import type {
	ExtractedFields,
	PlausibilityWarning,
	CriterionMatch,
} from '$lib/types/index.js';

// ─── Extracted Fields Variants ─────────────────────────────────────

export const allFieldsPresent: ExtractedFields = {
	age: 34,
	sbp: 88,
	hr: 125,
	rr: 28,
	gcs: 12,
	airwayStatus: 'Patent, maintained with jaw thrust',
	breathingStatus: 'Tachypneic, decreased breath sounds on left',
	mechanism: 'High-speed MVC with rollover, unrestrained driver',
	injuries: ['Left femur fracture', 'Left-sided flail chest', 'Scalp laceration'],
	additionalContext: 'Patient was found 15 feet from vehicle',
};

export const partialFields: ExtractedFields = {
	age: 72,
	sbp: 102,
	hr: 98,
	rr: null,
	gcs: null,
	airwayStatus: 'Intact',
	breathingStatus: null,
	mechanism: 'Ground-level fall',
	injuries: ['Hip pain'],
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
		field: 'sbp',
		value: 240,
		message: 'SBP of 240 mmHg is unusually high — verify reading',
	},
	{
		field: 'hr',
		value: 210,
		message: 'HR of 210 bpm exceeds expected range for age — verify reading',
	},
];

// ─── Criterion Matches ─────────────────────────────────────────────

export const level1Deterministic: CriterionMatch = {
	criterionId: 1,
	description: 'GCS ≤ 8 (Adult)',
	activationLevel: 'Level 1',
	category: 'Adult',
	ageRangeLabel: '≥15 years',
	source: 'deterministic',
	triggerReason: 'GCS score of 6 is ≤ 8',
};

export const level1Llm: CriterionMatch = {
	criterionId: 45,
	description: 'Penetrating injury to head, neck, torso, or proximal extremities',
	activationLevel: 'Level 1',
	category: 'Adult',
	ageRangeLabel: '≥15 years',
	source: 'llm',
	confidence: 0.92,
	triggerReason: 'Report describes gunshot wound to the abdomen',
};

export const level2Match: CriterionMatch = {
	criterionId: 78,
	description: 'Two or more proximal long-bone fractures',
	activationLevel: 'Level 2',
	category: 'Adult',
	ageRangeLabel: '≥15 years',
	source: 'deterministic',
	triggerReason: 'Bilateral femur fractures identified',
};

export const level3Match: CriterionMatch = {
	criterionId: 110,
	description: 'Ground-level fall in patient ≥65 years on anticoagulants',
	activationLevel: 'Level 3',
	category: 'Geriatric',
	ageRangeLabel: '≥65 years',
	source: 'llm',
	confidence: 0.85,
	triggerReason: 'Patient is 72 years old, on warfarin, ground-level fall',
};

export const pediatricMatch: CriterionMatch = {
	criterionId: 130,
	description: 'Pediatric patient with GCS ≤ 12',
	activationLevel: 'Level 1',
	category: 'Pediatric',
	ageRangeLabel: '<15 years',
	source: 'deterministic',
	triggerReason: 'GCS score of 10 in 8-year-old patient',
};

export const pediatricLevel2: CriterionMatch = {
	criterionId: 135,
	description: 'Bicycle vs. automobile collision (Pediatric)',
	activationLevel: 'Level 2',
	category: 'Pediatric',
	ageRangeLabel: '<15 years',
	source: 'llm',
	confidence: 0.88,
	triggerReason: 'Child struck by car while riding bicycle',
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
		description: 'Suspected spinal cord injury with motor deficit',
		activationLevel: 'Level 1',
		category: 'Adult',
		ageRangeLabel: '≥15 years',
		source: 'llm',
		confidence: 0.78,
		triggerReason: 'Loss of sensation below T10 with bilateral leg weakness',
	},
	{
		criterionId: 95,
		description: 'Crush injury to torso or extremity with ischemia',
		activationLevel: 'Level 2',
		category: 'Adult',
		ageRangeLabel: '≥15 years',
		source: 'llm',
		confidence: 0.65,
		triggerReason: 'Prolonged entrapment under machinery, right leg pulseless',
	},
];

// ─── Text Fixtures ──────────────────────────────────────────────────

export const level1Justification =
	'Patient meets Level 1 trauma activation criteria: GCS ≤ 8 indicating severe traumatic brain injury, combined with penetrating abdominal wound. Immediate full trauma team activation recommended.';

export const level2Justification =
	'Patient meets Level 2 trauma activation criteria: bilateral proximal long-bone fractures indicating high-energy mechanism. Priority trauma team response recommended.';

export const level3Justification =
	'Patient meets Level 3 trauma activation criteria: elderly patient on anticoagulants with ground-level fall and hip injury. Trauma consultation recommended.';

export const standardTriageJustification =
	'No trauma activation criteria met. Patient may be evaluated through standard triage protocols.';

export const sampleReasoning = `Extraction phase identified a 34-year-old male involved in a high-speed MVC with rollover. Patient was unrestrained and found 15 feet from vehicle, suggesting ejection.

Vital signs: SBP 88 (hypotensive), HR 125 (tachycardic), RR 28 (tachypneic), GCS 12 (moderate TBI).

Deterministic evaluation triggered Level 1 for SBP < 90 and Level 2 for GCS 9-12 range.

LLM evaluation identified additional criteria: penetrating mechanism not applicable, but high-energy mechanism with ejection meets Level 1 criteria (criterion #42). Flail chest with respiratory compromise also flags Level 1 (criterion #15, confidence 0.91).

Final determination: Level 1 activation based on hemodynamic instability (SBP < 90), high-energy mechanism with ejection, and flail chest. Multiple Level 1 criteria corroborate the highest activation level.`;

export const sampleReport = `EMS Report: 34-year-old male, high-speed MVC with rollover on I-85. Patient was unrestrained driver, found approximately 15 feet from vehicle suggesting partial ejection.

Vitals on scene: BP 88/62, HR 125, RR 28, GCS 12 (E3V4M5). SpO2 92% on 15L NRB.

Airway patent, maintained with jaw thrust. Decreased breath sounds on left with paradoxical chest wall movement consistent with flail segment. Left femur angulated and shortened. Large scalp laceration with active bleeding controlled with pressure dressing.

IV access x2 established, 500mL NS bolus initiated. C-collar applied, boarded. ETA 8 minutes.`;
