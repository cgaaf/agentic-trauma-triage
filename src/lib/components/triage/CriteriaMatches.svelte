<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { CriterionMatch, ActivationLevel, Category } from '$lib/types/index.js';

	let { matches }: { matches: CriterionMatch[] } = $props();

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
</script>

{#if matches.length > 0}
	{@const grouped = groupMatches(matches)}
	<div class="space-y-4">
		<h3 class="text-sm font-semibold">Matched Criteria</h3>
		{#each [...grouped] as [level, categories]}
			<div class="rounded-lg border {levelBg[level]} p-3">
				<h4 class="text-lg font-bold tracking-wide {levelColors[level]}">
					{level.toUpperCase()}
				</h4>
				{#each [...categories] as [categoryLabel, categoryMatches]}
					<div class="mt-2">
						<p class="text-xs font-medium text-muted-foreground">{categoryLabel}</p>
						<ul class="mt-1 space-y-1.5">
							{#each categoryMatches as match}
								<li class="flex flex-wrap items-start gap-2 text-sm">
									<span class="shrink-0">&#8226;</span>
									<div class="min-w-0 flex-1">
										<span class="font-medium">{match.description}</span>
										<span class="text-muted-foreground"> — {match.triggerReason}</span>
										{#if match.confidence !== undefined}
											<Badge variant="outline" class="ml-1.5 text-xs">
												{Math.round(match.confidence * 100)}%
											</Badge>
										{/if}
										<Badge variant="secondary" class="ml-1 text-xs">
											{match.source}
										</Badge>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		{/each}
	</div>
{/if}
