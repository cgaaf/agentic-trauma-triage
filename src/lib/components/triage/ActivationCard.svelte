<script lang="ts">
	import type { FinalActivationLevel } from '$lib/types/index.js';

	let {
		level,
		justification,
	}: {
		level: FinalActivationLevel;
		justification: string;
	} = $props();

	const config: Record<
		FinalActivationLevel,
		{ label: string; subtitle: string; borderColor: string; bgColor: string; textColor: string }
	> = {
		'Level 1': {
			label: 'LEVEL 1',
			subtitle: 'Critical Activation',
			borderColor: 'border-l-red-600',
			bgColor: 'bg-red-50 dark:bg-red-950/40',
			textColor: 'text-red-700 dark:text-red-400',
		},
		'Level 2': {
			label: 'LEVEL 2',
			subtitle: 'High-Priority Activation',
			borderColor: 'border-l-orange-500',
			bgColor: 'bg-orange-50 dark:bg-orange-950/40',
			textColor: 'text-orange-700 dark:text-orange-400',
		},
		'Level 3': {
			label: 'LEVEL 3',
			subtitle: 'Moderate Activation',
			borderColor: 'border-l-yellow-500',
			bgColor: 'bg-yellow-50 dark:bg-yellow-950/40',
			textColor: 'text-yellow-700 dark:text-yellow-400',
		},
		'Standard Triage': {
			label: 'STANDARD TRIAGE',
			subtitle: 'No Activation Criteria Met',
			borderColor: 'border-l-gray-400',
			bgColor: 'bg-muted/50',
			textColor: 'text-muted-foreground',
		},
	};

	const c = $derived(config[level]);
</script>

<div class="rounded-lg border border-l-4 {c.borderColor} {c.bgColor} p-4">
	<div class="flex items-baseline gap-3">
		<span class="text-2xl font-extrabold tracking-wider {c.textColor}">
			{c.label}
		</span>
		<span class="text-sm font-medium {c.textColor}">
			— {c.subtitle}
		</span>
	</div>
	{#if justification}
		<p class="mt-2 text-sm text-foreground/80">{justification}</p>
	{/if}
</div>
