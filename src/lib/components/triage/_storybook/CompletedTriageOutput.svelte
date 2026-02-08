<script lang="ts">
	import ReportDisplay from '../ReportDisplay.svelte';
	import RecognizedInputs from '../RecognizedInputs.svelte';
	import ActivationCard from '../ActivationCard.svelte';
	import CriteriaMatches from '../CriteriaMatches.svelte';
	import DisclaimerFooter from '../DisclaimerFooter.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
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

	<Separator />

	<RecognizedInputs {fields} {warnings} {missingFieldWarnings} />

	<ActivationCard
		level={activationLevel}
		matches={levelMatches}
		{justification}
		{agentReasoning}
	/>

	{#if otherMatches.length > 0}
		<CriteriaMatches matches={otherMatches} />
	{/if}

	<DisclaimerFooter />
</div>
