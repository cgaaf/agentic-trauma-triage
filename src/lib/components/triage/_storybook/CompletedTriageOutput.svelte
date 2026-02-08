<script lang="ts">
	import ReportInput from '../ReportInput.svelte';
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
		onsubmit,
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
		onsubmit?: (report: string) => void;
	} = $props();
</script>

<div class="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
	<ReportInput value={report} loading={false} collapsed={true} {onsubmit} />

	<Separator />

	<RecognizedInputs {fields} {warnings} />

	{#if missingFieldWarnings.length > 0}
		<div class="space-y-1">
			{#each missingFieldWarnings as warning (warning)}
				<p class="text-xs text-amber-600 dark:text-amber-400">{warning}</p>
			{/each}
		</div>
	{/if}

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
