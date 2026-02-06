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

	const fieldDefs = [
		{ key: 'age', label: 'Age', unit: 'years' },
		{ key: 'sbp', label: 'SBP', unit: 'mmHg' },
		{ key: 'hr', label: 'HR', unit: 'bpm' },
		{ key: 'rr', label: 'RR', unit: 'breaths/min' },
		{ key: 'gcs', label: 'GCS', unit: '' },
		{ key: 'airwayStatus', label: 'Airway', unit: '' },
		{ key: 'breathingStatus', label: 'Breathing', unit: '' },
		{ key: 'mechanism', label: 'Mechanism', unit: '' },
		{ key: 'injuries', label: 'Injuries', unit: '' },
	] as const;

	function getWarning(field: string): PlausibilityWarning | undefined {
		return warnings.find((w) => w.field === field);
	}

	function formatValue(key: string, value: unknown, unit: string): string {
		if (value === null || value === undefined) return '';
		if (Array.isArray(value)) return value.join(', ');
		return unit ? `${value} ${unit}` : String(value);
	}
</script>

<div class="space-y-1.5">
	<h3 class="text-sm font-semibold">Recognized Inputs</h3>
	<div class="grid gap-1">
		{#each fieldDefs as { key, label, unit }}
			{@const value = fields[key as keyof ExtractedFields]}
			{@const warning = getWarning(key)}
			{@const present = value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)}
			<div class="flex items-start gap-2 py-0.5">
				{#if present}
					<Check class="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" />
				{:else}
					<AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-500" />
				{/if}
				<div class="min-w-0">
					<span class="text-sm">
						<span class="font-medium">{label}:</span>
						{#if present}
							<span>{formatValue(key, value, unit)}</span>
						{:else}
							<span class="text-muted-foreground">Not provided</span>
						{/if}
					</span>
					{#if warning}
						<p class="text-xs text-amber-600 dark:text-amber-400">{warning.message}</p>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
