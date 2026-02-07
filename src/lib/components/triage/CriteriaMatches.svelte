<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDown } from '@lucide/svelte';
	import type { CriterionMatch, ActivationLevel, Category } from '$lib/types/index.js';

	let { matches }: { matches: CriterionMatch[] } = $props();

	let expandedLevels: Record<string, boolean> = $state({});

	const levelColors: Record<string, string> = {
		'Level 1': 'text-red-700 dark:text-red-400',
		'Level 2': 'text-orange-700 dark:text-orange-400',
		'Level 3': 'text-yellow-700 dark:text-yellow-400',
	};

	const levelBg: Record<string, string> = {
		'Level 1': 'bg-red-50 dark:bg-red-950/30',
		'Level 2': 'bg-orange-50 dark:bg-orange-950/30',
		'Level 3': 'bg-yellow-50 dark:bg-yellow-950/30',
	};

	// Group matches by activation level, then by category
	type GroupedMatches = Map<ActivationLevel, Map<string, CriterionMatch[]>>;

	function groupMatches(matches: CriterionMatch[]): GroupedMatches {
		const levels: ActivationLevel[] = ['Level 1', 'Level 2', 'Level 3'];
		const grouped: GroupedMatches = new Map();

		for (const level of levels) {
			const levelMatches = matches.filter((m) => m.activationLevel === level);
			if (levelMatches.length === 0) continue;

			const byCategory = new Map<string, CriterionMatch[]>();
			for (const match of levelMatches) {
				const key = `${match.category} (${match.ageRangeLabel})`;
				const arr = byCategory.get(key) ?? [];
				arr.push(match);
				byCategory.set(key, arr);
			}
			grouped.set(level, byCategory);
		}

		return grouped;
	}

	function countLevelMatches(categories: Map<string, CriterionMatch[]>): number {
		let count = 0;
		for (const arr of categories.values()) count += arr.length;
		return count;
	}
</script>

{#if matches.length > 0}
	{@const grouped = groupMatches(matches)}
	<div class="space-y-4">
		<h3 class="text-sm font-semibold">Matched Criteria</h3>
		{#each [...grouped] as [level, categories] (level)}
			{@const matchCount = countLevelMatches(categories)}
			<div class="rounded-lg border {levelBg[level]} p-3 space-y-2">
				<div class="flex items-start justify-between gap-2">
					<h4 class="text-lg font-bold tracking-wide {levelColors[level]}">
						{level.toUpperCase()}
					</h4>
					<span class="text-xs text-muted-foreground mt-1">
						{matchCount} {matchCount === 1 ? 'criterion' : 'criteria'}
					</span>
				</div>
				{#each [...categories] as [categoryLabel, categoryMatches] (categoryLabel)}
					<div>
						<p class="text-xs font-medium text-muted-foreground">{categoryLabel}</p>
						<div class="mt-1 rounded-md border bg-background/50 overflow-hidden">
							<div class="divide-y divide-dashed divide-border">
								{#each categoryMatches as match (match.criterionId)}
									<div class="px-3 py-2">
										<p class="text-sm font-medium">{match.description}</p>
										{#if expandedLevels[level]}
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
					</div>
				{/each}
				<div>
					<Button
						variant="ghost"
						size="sm"
						class="h-7 gap-1.5 text-xs text-muted-foreground"
						onclick={() => (expandedLevels[level] = !expandedLevels[level])}
					>
						<ChevronDown class="size-3.5 transition-transform {expandedLevels[level] ? 'rotate-180' : ''}" />
						{expandedLevels[level] ? 'Hide' : 'Show'} details
					</Button>
				</div>
			</div>
		{/each}
	</div>
{/if}
