<script lang="ts">
	import { slide } from 'svelte/transition';
	import { AlertTriangle, ChevronDown } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ExtractedFields, PlausibilityWarning } from '$lib/types/index.js';

	let {
		fields,
		warnings = [],
		missingFieldWarnings = [],
	}: {
		fields: ExtractedFields;
		warnings?: PlausibilityWarning[];
		missingFieldWarnings?: string[];
	} = $props();

	const allWarnings = $derived([
		...warnings.map((w) => w.message),
		...missingFieldWarnings,
	]);

	const vitalDefs = [
		{ key: 'age', label: 'Age', unit: 'yr' },
		{ key: 'sbp', label: 'SBP', unit: 'mmHg' },
		{ key: 'hr', label: 'HR', unit: 'bpm' },
		{ key: 'rr', label: 'RR', unit: '/min' },
		{ key: 'gcs', label: 'GCS', unit: '' },
	] as const;

	const clinicalDefs = [
		{ key: 'airwayStatus', label: 'Airway' },
		{ key: 'breathingStatus', label: 'Breathing' },
		{ key: 'mechanism', label: 'Mechanism' },
		{ key: 'injuries', label: 'Injuries' },
	] as const;

	const chipClasses: Record<string, string> = {
		present: 'rounded-md border border-muted-foreground/20 bg-muted/30 dark:border-muted-foreground/25',
		warning: 'rounded-md border border-amber-500/50 bg-muted/30 dark:border-amber-500/40',
		missing: 'rounded-md border border-dashed border-muted-foreground/20 bg-muted/30 dark:border-muted-foreground/25',
	};

	function getWarning(field: string): PlausibilityWarning | undefined {
		return warnings.find((w) => w.field === field);
	}

	function isPresent(value: unknown): boolean {
		if (value === null || value === undefined) return false;
		if (Array.isArray(value) && value.length === 0) return false;
		return true;
	}

	function formatClinical(value: unknown): string {
		if (Array.isArray(value)) return value.join(', ');
		return String(value);
	}

	type ChipState = 'present' | 'warning' | 'missing';

	function getChipState(key: string, value: unknown): ChipState {
		if (!isPresent(value)) return 'missing';
		if (getWarning(key)) return 'warning';
		return 'present';
	}

	let contextExpanded = $state(false);

	const hasAdditionalContext = $derived(
		fields.additionalContext != null && fields.additionalContext.trim() !== ''
	);
</script>

{#snippet chipBody(label: string, value: unknown, unit: string, state: ChipState)}
	<div class="flex flex-1 flex-col px-3 py-1.5 {chipClasses[state]}">
		<span class="text-muted-foreground text-xs leading-none">{label}</span>
		<div class="mt-0.5 flex items-baseline gap-0.5">
			{#if state === 'missing'}
				<span class="text-muted-foreground text-base font-bold leading-none">&mdash;</span>
			{:else}
				<span class="text-foreground font-mono tabular-nums text-base font-bold leading-none">{value}</span>
				{#if unit}
					<span class="text-muted-foreground/60 text-xs leading-none">{unit}</span>
				{/if}
				{#if state === 'warning'}
					<AlertTriangle class="size-3 shrink-0 text-amber-500" />
				{/if}
			{/if}
		</div>
	</div>
{/snippet}

<div class="space-y-3">
	<h3 class="text-sm font-bold tracking-wide text-muted-foreground/60 [font-variant-caps:small-caps]">Extracted Data</h3>

	<!-- Vital Signs — full width flex wrap -->
	<div class="flex flex-wrap gap-2">
		{#each vitalDefs as { key, label, unit } (key)}
			{@const value = fields[key as keyof ExtractedFields]}
			{@const state = getChipState(key, value)}
			{@render chipBody(label, value, unit, state)}
		{/each}
	</div>

	<!-- Clinical Details — 2-column grid on md: -->
	<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
		{#each clinicalDefs as { key, label } (key)}
			{@const value = fields[key as keyof ExtractedFields]}
			{@const state = getChipState(key, value)}
			<div class="flex flex-col px-3 py-1.5 {chipClasses[state]}">
				<span class="text-muted-foreground text-xs leading-none">{label}</span>
				<div class="mt-0.5">
					{#if state === 'missing'}
						<span class="text-muted-foreground text-sm leading-snug">&mdash;</span>
					{:else}
						<div class="flex items-start gap-1">
							<span class="text-foreground font-mono text-sm font-medium leading-normal">{formatClinical(value)}</span>
							{#if state === 'warning'}
								<AlertTriangle class="mt-0.5 size-3 shrink-0 text-amber-500" />
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Additional Context (progressive disclosure) -->
	{#if hasAdditionalContext}
		<div>
			<Button
				variant="ghost"
				size="sm"
				class="h-7 gap-1 px-2 text-xs text-muted-foreground"
				onclick={() => (contextExpanded = !contextExpanded)}
			>
				<ChevronDown class="size-3 transition-transform {contextExpanded ? 'rotate-180' : ''}" />
				Additional context
			</Button>
			{#if contextExpanded}
				<div transition:slide={{ duration: 150 }} class="mt-1 px-3 py-1.5 {chipClasses.present}">
					<span class="text-foreground font-mono text-sm leading-normal">{fields.additionalContext}</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Consolidated Warnings -->
	{#if allWarnings.length > 0}
		<div class="space-y-1 rounded-md border border-amber-500/30 px-3 py-2">
			{#each allWarnings as message (message)}
				<div class="flex items-start gap-1.5">
					<AlertTriangle class="mt-0.5 size-3 shrink-0 text-amber-500" />
					<span class="text-xs text-amber-600 dark:text-amber-400">{message}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
