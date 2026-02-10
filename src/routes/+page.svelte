<script lang="ts">
	import { tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { browser } from '$app/environment';
	import Header from '$lib/components/triage/Header.svelte';
	import ReportInput from '$lib/components/triage/ReportInput.svelte';
	import ReportDisplay from '$lib/components/triage/ReportDisplay.svelte';
	import ProgressSteps from '$lib/components/triage/ProgressSteps.svelte';
	import ExtractedData from '$lib/components/triage/ExtractedData.svelte';
	import AdditionalCriteria from '$lib/components/triage/AdditionalCriteria.svelte';
	import ActivationCard from '$lib/components/triage/ActivationCard.svelte';
	import DisclaimerFooter from '$lib/components/triage/DisclaimerFooter.svelte';
	import DisclaimerModal from '$lib/components/triage/DisclaimerModal.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	import { AlertTriangle, RotateCcw } from '@lucide/svelte';
	import { triageState } from '$lib/state/triage.svelte.js';

	let reportValue = $state('');
	let reportExpanded = $state(false);
	let showProgressSteps = $state(true);
	let activationCardEl = $state<HTMLDivElement>();
	let disclaimerOpen = $state(false);

	$effect(() => {
		if (browser) {
			disclaimerOpen = localStorage.getItem('disclaimer-accepted') !== 'true';
		}
	});

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

	$effect(() => {
		if (triageState.activationLevel) {
			reportExpanded = false;
			tick().then(() => {
				activationCardEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
		}
	});

	function handleSubmit(report: string) {
		reportExpanded = true;
		triageState.submitReport(report);
	}

	function handleRetry() {
		if (triageState.report) {
			triageState.submitReport(triageState.report);
		}
	}

	function handleNewTriage() {
		triageState.reset();
		reportValue = '';
		reportExpanded = false;
		showProgressSteps = true;
	}
</script>

<svelte:head>
	<title>Trauma Triage Agent</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header showNewTriage={triageState.phase === 'complete'} onNewTriage={handleNewTriage} />

	<main
		class="mx-auto w-full max-w-4xl flex-1 px-4 py-6 {triageState.phase === 'idle'
			? 'flex flex-col items-center justify-center'
			: 'space-y-6'}"
	>
		<!-- Input Section -->
		{#if triageState.phase === 'idle' || triageState.phase === 'error'}
			<div class={triageState.phase === 'idle' ? 'w-full max-w-2xl' : ''} transition:slide={{ duration: 300 }}>
				{#if triageState.phase === 'idle'}
					<h1 class="mb-6 text-center text-3xl font-semibold tracking-tight text-foreground">
						Enter your report.
					</h1>
				{/if}
				<ReportInput bind:value={reportValue} loading={triageState.isLoading} onsubmit={handleSubmit} />
			</div>
		{:else}
			<div transition:slide={{ duration: 300 }}>
				<ReportDisplay text={reportValue} bind:expanded={reportExpanded} />
			</div>
		{/if}

		{#if triageState.phase !== 'idle'}
			<div
				class="h-px w-full"
				style="background-image: repeating-linear-gradient(90deg, var(--border) 0 6px, transparent 6px 12px)"
			></div>
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
			<div bind:this={activationCardEl} class="scroll-mt-16">
				<ActivationCard
					level={triageState.activationLevel}
					matches={levelMatches}
					justification={triageState.justification}
					agentReasoning={triageState.agentReasoning}
				/>
			</div>
		{/if}

		<!-- Criteria Matches (other levels only) -->
		{#if triageState.activationLevel && triageState.allMatches.length > 0}
			{@const otherMatches = triageState.allMatches.filter(m => m.activationLevel !== triageState.activationLevel)}
			{#if otherMatches.length > 0}
				<AdditionalCriteria matches={otherMatches} />
			{/if}
		{/if}

		<!-- Disclaimer -->
		{#if triageState.phase !== 'idle'}
			<DisclaimerFooter />
		{/if}
	</main>
</div>

<DisclaimerModal bind:open={disclaimerOpen} />
