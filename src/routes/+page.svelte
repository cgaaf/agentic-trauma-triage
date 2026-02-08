<script lang="ts">
	import { slide } from 'svelte/transition';
	import Header from '$lib/components/triage/Header.svelte';
	import ReportInput from '$lib/components/triage/ReportInput.svelte';
	import ReportDisplay from '$lib/components/triage/ReportDisplay.svelte';
	import WelcomeView from '$lib/components/triage/WelcomeView.svelte';
	import ProgressSteps from '$lib/components/triage/ProgressSteps.svelte';
	import ExtractedData from '$lib/components/triage/ExtractedData.svelte';
	import AdditionalCriteria from '$lib/components/triage/AdditionalCriteria.svelte';
	import ActivationCard from '$lib/components/triage/ActivationCard.svelte';
	import DisclaimerFooter from '$lib/components/triage/DisclaimerFooter.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { AlertTriangle, RotateCcw } from '@lucide/svelte';
	import { triageState } from '$lib/state/triage.svelte.js';

	let { data } = $props();
	let reportValue = $state('');
	let showProgressSteps = $state(true);

	$effect(() => {
		const phase = triageState.phase;
		if (phase === 'complete') {
			const timer = setTimeout(() => { showProgressSteps = false; }, 1000);
			return () => clearTimeout(timer);
		}
		if (phase !== 'idle') {
			showProgressSteps = true;
		}
	});

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
		{#if triageState.phase === 'complete'}
			<div transition:slide={{ duration: 300 }}>
				<ReportDisplay text={reportValue} />
			</div>
		{:else}
			<div transition:slide={{ duration: 300 }}>
				<ReportInput bind:value={reportValue} loading={triageState.isLoading} onsubmit={handleSubmit} />
			</div>
		{/if}

		<Separator />

		<!-- Welcome / Idle State -->
		{#if triageState.phase === 'idle'}
			<WelcomeView />
		{/if}

		<!-- Progress Steps -->
		{#if triageState.phase !== 'idle' && showProgressSteps}
			<div transition:slide={{ duration: 300 }}>
				<ProgressSteps phase={triageState.phase} />
			</div>
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

		<!-- Extracted Data -->
		{#if triageState.extractedFields}
			<ExtractedData
				fields={triageState.extractedFields}
				warnings={triageState.plausibilityWarnings}
				missingFieldWarnings={triageState.missingFieldWarnings}
			/>
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
				<AdditionalCriteria matches={otherMatches} />
			{/if}
		{:else if triageState.deterministicMatches.length > 0}
			<AdditionalCriteria matches={triageState.deterministicMatches} />
		{/if}

		<!-- Disclaimer -->
		{#if triageState.phase !== 'idle'}
			<DisclaimerFooter />
		{/if}
	</main>
</div>
