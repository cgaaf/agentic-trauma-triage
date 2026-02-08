<script lang="ts">
	import ReportDisplay from '../ReportDisplay.svelte';
	import ExtractedData from '../ExtractedData.svelte';
	import ActivationCard from '../ActivationCard.svelte';
	import AdditionalCriteria from '../AdditionalCriteria.svelte';
	import DisclaimerFooter from '../DisclaimerFooter.svelte';

	import type {
		ExtractedFields,
		PlausibilityWarning,
		CriterionMatch,
		FinalActivationLevel,
	} from '$lib/types/index.js';

	let {
		report,
		fields,
		warnings = [],
		missingFieldWarnings = [],
		activationLevel,
		levelMatches,
		otherMatches = [],
		justification,
		agentReasoning,
	}: {
		report: string;
		fields: ExtractedFields;
		warnings?: PlausibilityWarning[];
		missingFieldWarnings?: string[];
		activationLevel: FinalActivationLevel;
		levelMatches: CriterionMatch[];
		otherMatches?: CriterionMatch[];
		justification: string;
		agentReasoning?: string;
	} = $props();
</script>

<div class="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
	<ReportDisplay text={report} />

	<div
		class="h-px w-full"
		style="background-image: repeating-linear-gradient(90deg, var(--border) 0 6px, transparent 6px 12px)"
	></div>

	<ExtractedData {fields} {warnings} {missingFieldWarnings} />

	<ActivationCard
		level={activationLevel}
		matches={levelMatches}
		{justification}
		{agentReasoning}
	/>

	{#if otherMatches.length > 0}
		<AdditionalCriteria matches={otherMatches} />
	{/if}

	<DisclaimerFooter />
</div>
