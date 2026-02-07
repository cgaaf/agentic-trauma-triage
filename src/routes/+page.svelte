<script lang="ts">
	import Header from '$lib/components/triage/Header.svelte';
	import ReportInput from '$lib/components/triage/ReportInput.svelte';
	import WelcomeView from '$lib/components/triage/WelcomeView.svelte';
	import ProgressSteps from '$lib/components/triage/ProgressSteps.svelte';
	import RecognizedInputs from '$lib/components/triage/RecognizedInputs.svelte';
	import CriteriaMatches from '$lib/components/triage/CriteriaMatches.svelte';
	import ActivationCard from '$lib/components/triage/ActivationCard.svelte';
	import DisclaimerFooter from '$lib/components/triage/DisclaimerFooter.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { AlertTriangle, RotateCcw } from '@lucide/svelte';
	import { triageState } from '$lib/state/triage.svelte.js';

	let { data } = $props();
	let reportValue = $state('');

	function handleSubmit(report: string) {
		triageState.submitReport(report);
	}

	function handleRetry() {
		if (triageState.report) {
			triageState.submitReport(triageState.report);
		}
	}
</script>

<svelte:head>
	<title>Trauma Triage Agent</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header mockMode={data.mockMode} />

	<main class="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6">
		<!-- Input Section -->
		<ReportInput bind:value={reportValue} loading={triageState.isLoading} onsubmit={handleSubmit} />

		<Separator />

		<!-- Welcome / Idle State -->
		{#if triageState.phase === 'idle'}
			<WelcomeView />
		{/if}

		<!-- Progress Steps -->
		{#if triageState.phase !== 'idle'}
			<ProgressSteps phase={triageState.phase} />
		{/if}

		<!-- Error Display -->
		{#if triageState.hasError}
			<Alert variant="destructive">
				<AlertTriangle class="size-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription class="flex items-start justify-between gap-4">
					<span>{triageState.errorMessage}</span>
					{#if triageState.canRetry}
						<Button variant="outline" size="sm" onclick={handleRetry}>
							<RotateCcw class="size-3.5" />
							Retry
						</Button>
					{/if}
				</AlertDescription>
			</Alert>
		{/if}

		<!-- Recognized Inputs -->
		{#if triageState.extractedFields}
			<RecognizedInputs
				fields={triageState.extractedFields}
				warnings={triageState.plausibilityWarnings}
			/>
		{/if}

		<!-- Missing Field Warnings -->
		{#if triageState.missingFieldWarnings.length > 0}
			<div class="space-y-1">
				{#each triageState.missingFieldWarnings as warning}
					<p class="text-xs text-amber-600 dark:text-amber-400">{warning}</p>
				{/each}
			</div>
		{/if}

		<!-- Activation Level Card -->
		{#if triageState.activationLevel}
			{@const levelMatches = triageState.allMatches.filter(m => m.activationLevel === triageState.activationLevel)}
			<ActivationCard
				level={triageState.activationLevel}
				matches={levelMatches}
				justification={triageState.justification}
				agentReasoning={triageState.agentReasoning}
			/>
		{/if}

		<!-- Criteria Matches (other levels only) -->
		{#if triageState.allMatches.length > 0}
			{@const otherMatches = triageState.allMatches.filter(m => m.activationLevel !== triageState.activationLevel)}
			{#if otherMatches.length > 0}
				<CriteriaMatches matches={otherMatches} />
			{/if}
		{:else if triageState.deterministicMatches.length > 0}
			<CriteriaMatches matches={triageState.deterministicMatches} />
		{/if}

		<!-- Disclaimer -->
		{#if triageState.phase !== 'idle'}
			<DisclaimerFooter />
		{/if}
	</main>
</div>
