<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CompletedTriageOutput from './_storybook/CompletedTriageOutput.svelte';
	import {
		allFieldsPresent,
		geriatricFields,
		pediatricFields,
		standardTriageFields,
		sampleWarnings,
		sampleReport,
		geriatricReport,
		pediatricReport,
		standardTriageReport,
		level1Deterministic,
		level1Llm,
		level2Match,
		level3Match,
		geriatricLevel2Match,
		geriatricLevel3Anticoag,
		pediatricMatch,
		pediatricLevel2,
		level1Justification,
		geriatricJustification,
		pediatricJustification,
		standardTriageJustification,
		sampleReasoning,
		sampleMissingFieldWarnings,
	} from './_storybook/mock-data.js';

	const { Story } = defineMeta({
		title: 'Triage/CompletedTriageOutput',
		component: CompletedTriageOutput,
		parameters: {
			layout: 'fullscreen',
		},
	});
</script>

<Story
	name="Level1FullData"
	args={{
		report: sampleReport,
		fields: allFieldsPresent,
		activationLevel: 'Level 1',
		levelMatches: [level1Deterministic, level1Llm],
		otherMatches: [level2Match, level3Match],
		justification: level1Justification,
		agentReasoning: sampleReasoning,
	}}
/>

<Story
	name="Level2Geriatric"
	args={{
		report: geriatricReport,
		fields: geriatricFields,
		activationLevel: 'Level 2',
		levelMatches: [geriatricLevel2Match],
		otherMatches: [geriatricLevel3Anticoag],
		justification: geriatricJustification,
		agentReasoning: `Extraction phase identified a 72-year-old female with ground-level fall. Patient on warfarin with INR 2.8.

Deterministic evaluation: no vital sign thresholds exceeded (SBP 102, HR 98, GCS 14 all within normal ranges).

LLM evaluation identified hip fracture in geriatric patient (criterion #105, confidence 0.91) and anticoagulant use with head strike (criterion #110, confidence 0.95).

Final determination: Level 2 activation based on geriatric hip fracture. Level 3 anticoagulant criterion also met but superseded by higher activation level.`,
	}}
/>

<Story
	name="Level1Pediatric"
	args={{
		report: pediatricReport,
		fields: pediatricFields,
		activationLevel: 'Level 1',
		levelMatches: [pediatricMatch],
		otherMatches: [pediatricLevel2],
		justification: pediatricJustification,
	}}
/>

<Story
	name="StandardTriage"
	args={{
		report: standardTriageReport,
		fields: standardTriageFields,
		activationLevel: 'Standard Triage',
		levelMatches: [],
		justification: standardTriageJustification,
	}}
/>

<Story
	name="Level1WithWarnings"
	args={{
		report: sampleReport,
		fields: {
			...allFieldsPresent,
			sbp: 240,
			hr: 210,
			rr: null,
			gcs: null,
		},
		warnings: sampleWarnings,
		missingFieldWarnings: sampleMissingFieldWarnings,
		activationLevel: 'Level 1',
		levelMatches: [level1Deterministic, level1Llm],
		otherMatches: [level2Match],
		justification: level1Justification,
		agentReasoning: sampleReasoning,
	}}
/>
