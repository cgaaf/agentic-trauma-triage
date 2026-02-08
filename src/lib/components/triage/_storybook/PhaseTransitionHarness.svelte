<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { slide } from 'svelte/transition';
	import { triageState } from '$lib/state/triage.svelte.js';

	import Header from '../Header.svelte';
	import ReportInput from '../ReportInput.svelte';
	import ReportDisplay from '../ReportDisplay.svelte';
	import ProgressSteps from '../ProgressSteps.svelte';
	import ExtractedData from '../ExtractedData.svelte';
	import ActivationCard from '../ActivationCard.svelte';
	import AdditionalCriteria from '../AdditionalCriteria.svelte';
	import DisclaimerFooter from '../DisclaimerFooter.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { AlertTriangle, RotateCcw, ChevronLeft, ChevronRight, RotateCw } from '@lucide/svelte';

	import type { PhaseScenario } from './phase-scenarios.js';

	let { scenario }: { scenario: PhaseScenario } = $props();

	let stepIndex = $state(0);
	let reportExpanded = $state(false);
	let showProgressSteps = $state(true);
	let reportValue = $state('');

	function applyStep(index: number) {
		const step = scenario.steps[index];
		if (!step) return;

		triageState.reset();

		triageState.phase = step.phase;
		if (step.report !== undefined) triageState.report = step.report;
		if (step.extractedFields !== undefined) triageState.extractedFields = step.extractedFields;
		if (step.plausibilityWarnings) triageState.plausibilityWarnings = step.plausibilityWarnings;
		if (step.deterministicMatches) triageState.deterministicMatches = step.deterministicMatches;
		if (step.llmMatches) triageState.llmMatches = step.llmMatches;
		if (step.allMatches) triageState.allMatches = step.allMatches;
		if (step.activationLevel !== undefined) triageState.activationLevel = step.activationLevel;
		if (step.justification !== undefined) triageState.justification = step.justification;
		if (step.agentReasoning !== undefined) triageState.agentReasoning = step.agentReasoning;
		if (step.missingFieldWarnings) triageState.missingFieldWarnings = step.missingFieldWarnings;
		if (step.errorMessage !== undefined) triageState.errorMessage = step.errorMessage;
		if (step.canRetry !== undefined) triageState.canRetry = step.canRetry;

		reportValue = step.report ?? '';

		// Explicit UI state management (no $effect needed)
		reportExpanded = step.phase !== 'idle' && step.phase !== 'complete' && step.phase !== 'error';
		showProgressSteps = step.phase !== 'idle' && step.phase !== 'complete';
	}

	function next() {
		if (stepIndex < scenario.steps.length - 1) {
			stepIndex++;
			applyStep(stepIndex);
		}
	}

	function prev() {
		if (stepIndex > 0) {
			stepIndex--;
			applyStep(stepIndex);
		}
	}

	function resetSteps() {
		stepIndex = 0;
		applyStep(0);
	}

	onMount(() => {
		applyStep(0);
	});

	onDestroy(() => {
		triageState.reset();
	});
</script>

<!-- Control Bar -->
<div class="sticky top-0 z-50 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
	<div class="mx-auto flex max-w-4xl items-center gap-3">
		<div class="flex items-center gap-1.5">
			<Button variant="outline" size="sm" onclick={prev} disabled={stepIndex === 0}>
				<ChevronLeft class="size-3.5" />
				Prev
			</Button>
			<Button variant="outline" size="sm" onclick={next} disabled={stepIndex === scenario.steps.length - 1}>
				Next
				<ChevronRight class="size-3.5" />
			</Button>
			<Button variant="ghost" size="sm" onclick={resetSteps}>
				<RotateCw class="size-3.5" />
				Reset
			</Button>
		</div>

		<div class="ml-auto text-sm text-muted-foreground">
			<span class="font-medium text-foreground">Step {stepIndex + 1}/{scenario.steps.length}:</span>
			{scenario.steps[stepIndex]?.label}
		</div>
	</div>
</div>

<!-- Page Content (replica of +page.svelte) -->
<div class="flex min-h-[calc(100vh-57px)] flex-col">
	<Header showNewTriage={triageState.phase === 'complete'} onNewTriage={resetSteps} />

	<main
		class="mx-auto w-full max-w-4xl flex-1 px-4 py-6 {triageState.phase === 'idle'
			? 'flex flex-col items-center justify-center'
			: 'space-y-6'}"
	>
		{#if triageState.phase === 'idle' || triageState.phase === 'error'}
			<div class={triageState.phase === 'idle' ? 'w-full max-w-2xl' : ''} transition:slide={{ duration: 300 }}>
				{#if triageState.phase === 'idle'}
					<h1 class="mb-6 text-center text-3xl font-semibold tracking-tight text-foreground">
						Enter your report.
					</h1>
				{/if}
				<ReportInput bind:value={reportValue} loading={triageState.isLoading} onsubmit={next} />
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

		{#if triageState.phase !== 'idle' && showProgressSteps}
			<div transition:slide={{ duration: 300 }}>
				<ProgressSteps phase={triageState.phase} />
			</div>
		{/if}

		{#if triageState.hasError}
			<Alert variant="destructive">
				<AlertTriangle class="size-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription class="flex items-start justify-between gap-4">
					<span>{triageState.errorMessage}</span>
					{#if triageState.canRetry}
						<Button variant="outline" size="sm" onclick={next}>
							<RotateCcw class="size-3.5" />
							Retry
						</Button>
					{/if}
				</AlertDescription>
			</Alert>
		{/if}

		{#if triageState.extractedFields}
			<ExtractedData
				fields={triageState.extractedFields}
				warnings={triageState.plausibilityWarnings}
				missingFieldWarnings={triageState.missingFieldWarnings}
			/>
		{/if}

		{#if triageState.activationLevel}
			{@const levelMatches = triageState.allMatches.filter(m => m.activationLevel === triageState.activationLevel)}
			<ActivationCard
				level={triageState.activationLevel}
				matches={levelMatches}
				justification={triageState.justification}
				agentReasoning={triageState.agentReasoning}
			/>
		{/if}

		{#if triageState.activationLevel && triageState.allMatches.length > 0}
			{@const otherMatches = triageState.allMatches.filter(m => m.activationLevel !== triageState.activationLevel)}
			{#if otherMatches.length > 0}
				<AdditionalCriteria matches={otherMatches} />
			{/if}
		{/if}

		{#if triageState.phase !== 'idle'}
			<DisclaimerFooter />
		{/if}
	</main>
</div>
