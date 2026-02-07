<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDown } from '@lucide/svelte';
	import type { CriterionMatch, FinalActivationLevel } from '$lib/types/index.js';

	let {
		level,
		matches,
		justification,
		agentReasoning,
	}: {
		level: FinalActivationLevel;
		matches: CriterionMatch[];
		justification: string;
		agentReasoning?: string;
	} = $props();

	let expanded = $state(false);

	const colors: Record<
		FinalActivationLevel,
		{ border: string; bg: string; text: string }
	> = {
		'Level 1': {
			border: 'border-l-red-600',
			bg: 'bg-red-50 dark:bg-red-950/40',
			text: 'text-red-700 dark:text-red-400',
		},
		'Level 2': {
			border: 'border-l-orange-500',
			bg: 'bg-orange-50 dark:bg-orange-950/40',
			text: 'text-orange-700 dark:text-orange-400',
		},
		'Level 3': {
			border: 'border-l-yellow-500',
			bg: 'bg-yellow-50 dark:bg-yellow-950/40',
			text: 'text-yellow-700 dark:text-yellow-400',
		},
		'Standard Triage': {
			border: 'border-l-gray-400',
			bg: 'bg-muted/50',
			text: 'text-muted-foreground',
		},
	};

	const c = $derived(colors[level]);

	/** Derive unique category + age labels from the matches */
	const categoryLabels = $derived(
		[...new Set(matches.map((m) => `${m.category} (${m.ageRangeLabel})`))],
	);
</script>

<div class="rounded-lg border border-l-4 {c.border} {c.bg} p-4 space-y-3">
	<!-- Header: Level name + criteria count -->
	<div class="flex items-start justify-between gap-2">
		<div>
			<h2 class="text-2xl font-extrabold tracking-wider {c.text}">
				{level.toUpperCase()}
			</h2>
			{#if categoryLabels.length > 0}
				<p class="mt-0.5 text-sm text-muted-foreground">
					{categoryLabels.join(' · ')}
				</p>
			{/if}
		</div>
		{#if matches.length > 0}
			<span class="text-xs text-muted-foreground mt-1.5">
				{matches.length} {matches.length === 1 ? 'criterion' : 'criteria'}
			</span>
		{/if}
	</div>

	<!-- Criteria list -->
	{#if matches.length > 0}
		<div class="rounded-md border bg-background/50 overflow-hidden">
			<div class="divide-y divide-dashed divide-border">
				{#each matches as match (match.criterionId)}
					<div class="px-3 py-2">
						<p class="text-sm font-medium">{match.description}</p>
						{#if expanded}
							<p class="mt-1 text-xs text-muted-foreground">{match.triggerReason}</p>
							<div class="mt-1.5 flex items-center gap-1.5">
								{#if match.confidence !== undefined}
									<Badge variant="outline" class="text-xs">
										{Math.round(match.confidence * 100)}%
									</Badge>
								{/if}
								<Badge variant="secondary" class="text-xs">
									{match.source}
								</Badge>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			</div>
	{/if}

	<!-- Expandable justification / reasoning -->
	{#if expanded && (justification || agentReasoning)}
		<div class="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground whitespace-pre-wrap space-y-3">
			{#if justification}
				<div>
					<p class="font-medium text-foreground/70 mb-1">Justification</p>
					<p>{justification}</p>
				</div>
			{/if}
			{#if agentReasoning}
				<div>
					<p class="font-medium text-foreground/70 mb-1">Agent Reasoning</p>
					<p>{agentReasoning}</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Single expand/collapse toggle -->
	<div class="flex justify-center">
		<Button
			variant="ghost"
			size="sm"
			class="h-7 gap-1.5 text-xs text-muted-foreground"
			onclick={() => (expanded = !expanded)}
		>
			<ChevronDown class="size-3.5 transition-transform {expanded ? 'rotate-180' : ''}" />
			{expanded ? 'Hide' : 'Show'} details
		</Button>
	</div>
</div>
