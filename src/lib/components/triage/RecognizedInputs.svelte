<script lang="ts">
	import { Check, AlertTriangle } from '@lucide/svelte';
	import type { ExtractedFields, PlausibilityWarning } from '$lib/types/index.js';

	let {
		fields,
		warnings = [],
	}: {
		fields: ExtractedFields;
		warnings?: PlausibilityWarning[];
	} = $props();

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
		present: 'border-l-green-500 bg-green-500/8 dark:bg-green-500/10',
		warning: 'border-l-amber-500 bg-amber-500/10 dark:bg-amber-500/15',
		missing: 'border-l-muted-foreground/40 bg-muted/50',
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
</script>

{#snippet chipBody(label: string, value: unknown, unit: string, state: ChipState)}
	<div
		class="flex flex-1 flex-col rounded-r-md border-l-[3px] px-3 py-1.5 {chipClasses[state]}"
	>
		<span class="text-muted-foreground text-xs leading-none">{label}</span>
		<div class="mt-0.5 flex items-baseline gap-0.5">
			{#if state === 'missing'}
				<span class="text-muted-foreground text-base font-bold leading-none">&mdash;</span>
			{:else}
				<span class="text-foreground tabular-nums text-base font-bold leading-none">{value}</span>
				{#if unit}
					<span class="text-muted-foreground/60 text-xs leading-none">{unit}</span>
				{/if}
			{/if}
		</div>
	</div>
{/snippet}

<div class="space-y-3">
	<h3 class="text-sm font-semibold">Recognized Inputs</h3>

	<!-- Vital Signs — full width flex wrap -->
	<div class="flex flex-wrap gap-2">
		{#each vitalDefs as { key, label, unit } (key)}
			{@const value = fields[key as keyof ExtractedFields]}
			{@const state = getChipState(key, value)}
			{@render chipBody(label, value, unit, state)}
		{/each}
	</div>

	<!-- Warnings — full width -->
	{#if warnings.length > 0}
		<div class="space-y-1">
			{#each warnings as warning (warning.field)}
				<div class="flex items-start gap-1.5">
					<AlertTriangle class="mt-0.5 size-3.5 shrink-0 text-amber-500" />
					<p class="text-sm text-amber-700 dark:text-amber-400">
						{warning.message}
					</p>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Clinical Details — 2-column grid on md: -->
	<div class="grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2">
		{#each clinicalDefs as { key, label } (key)}
			{@const value = fields[key as keyof ExtractedFields]}
			{@const present = isPresent(value)}
			<div class="flex items-start gap-1.5">
				{#if present}
					<Check class="mt-0.5 size-3.5 shrink-0 text-green-600 dark:text-green-400" />
				{:else}
					<AlertTriangle class="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
				{/if}
				<p class="text-sm">
					<span class="text-muted-foreground">{label}:</span>
					{#if present}
						<span>{formatClinical(value)}</span>
					{:else}
						<span class="text-muted-foreground italic">Not provided</span>
					{/if}
				</p>
			</div>
		{/each}
	</div>
</div>
