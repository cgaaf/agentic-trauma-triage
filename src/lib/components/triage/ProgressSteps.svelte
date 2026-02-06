<script lang="ts">
	import { Check, Loader2, Circle } from '@lucide/svelte';
	import type { TriagePhase } from '$lib/state/triage.svelte.js';

	let { phase }: { phase: TriagePhase } = $props();

	const steps = [
		{ id: 'extracting', label: 'Extracting details...' },
		{ id: 'evaluating_vitals', label: 'Evaluating vitals...' },
		{ id: 'analyzing_mechanism', label: 'Analyzing mechanism & injuries...' },
		{ id: 'complete', label: 'Complete' },
	] as const;

	const phaseOrder: Record<string, number> = {
		extracting: 0,
		evaluating_vitals: 1,
		analyzing_mechanism: 2,
		complete: 3,
	};

	function getStepStatus(stepId: string): 'done' | 'active' | 'pending' {
		const currentIndex = phaseOrder[phase] ?? -1;
		const stepIndex = phaseOrder[stepId] ?? -1;

		if (stepIndex < currentIndex) return 'done';
		if (stepIndex === currentIndex) return phase === 'complete' ? 'done' : 'active';
		return 'pending';
	}
</script>

{#if phase !== 'idle'}
	<div class="space-y-2">
		{#each steps as step}
			{@const status = getStepStatus(step.id)}
			<div class="flex items-center gap-3">
				{#if status === 'done'}
					<div class="flex size-6 items-center justify-center rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
						<Check class="size-4" />
					</div>
				{:else if status === 'active'}
					<div class="flex size-6 items-center justify-center text-primary">
						<Loader2 class="size-4 animate-spin" />
					</div>
				{:else}
					<div class="flex size-6 items-center justify-center text-muted-foreground/40">
						<Circle class="size-4" />
					</div>
				{/if}
				<span
					class="text-sm {status === 'done'
						? 'text-foreground'
						: status === 'active'
							? 'font-medium text-foreground'
							: 'text-muted-foreground/60'}"
				>
					{step.label}
				</span>
			</div>
		{/each}
	</div>
{/if}
