<script lang="ts">
	import { slide } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDown } from '@lucide/svelte';
	import type { CriterionMatch, ActivationLevel } from '$lib/types/index.js';

	let { matches }: { matches: CriterionMatch[] } = $props();

	let expanded = $state(false);

	type LevelGroup = {
		level: ActivationLevel;
		matches: CriterionMatch[];
		categoryLabels: string[];
	};

	function groupByLevel(matches: CriterionMatch[]): LevelGroup[] {
		const levels: ActivationLevel[] = ['Level 1', 'Level 2', 'Level 3'];
		const groups: LevelGroup[] = [];

		for (const level of levels) {
			const levelMatches = matches.filter((m) => m.activationLevel === level);
			if (levelMatches.length === 0) continue;

			const categoryLabels = [
				...new Set(levelMatches.map((m) => `${m.category} (${m.ageRangeLabel})`)),
			];
			groups.push({ level, matches: levelMatches, categoryLabels });
		}

		return groups;
	}
</script>

{#if matches.length > 0}
	{@const groups = groupByLevel(matches)}
	<div class="space-y-3">
	<div
		class="h-px w-full"
		style="background-image: repeating-linear-gradient(90deg, var(--border) 0 6px, transparent 6px 12px)"
	></div>
	<h3 class="text-sm font-bold tracking-wide text-muted-foreground/60 [font-variant-caps:small-caps]">Additional Criteria Met</h3>
	<div class="rounded-lg border border-dashed bg-muted/30 p-4 space-y-3">
		<div class="space-y-6">
			{#each groups as group, i (group.level)}
				<!-- Dashed divider between level groups -->
				{#if i > 0}
					<div class="border-t border-dashed border-border"></div>
				{/if}

				<div class="space-y-2.5">
					<div class="flex items-baseline justify-between gap-2">
						<div class="flex items-baseline gap-2">
							<h4 class="text-sm font-semibold text-muted-foreground">
								{group.level.toUpperCase()}
							</h4>
							<span class="text-xs text-muted-foreground/60">
								{group.categoryLabels.join(' · ')}
							</span>
						</div>
						<span class="text-xs text-muted-foreground">
							{group.matches.length}
							{group.matches.length === 1 ? 'criterion' : 'criteria'}
						</span>
					</div>

					<div class="rounded-md border bg-background/50 overflow-hidden">
						<div class="divide-y divide-dashed divide-border">
							{#each group.matches as match (match.criterionId)}
								<div class="px-3 py-2">
									<p class="font-mono text-sm font-medium">{match.description}</p>
									{#if expanded}
										<div transition:slide={{ duration: 150 }}>
											<p class="mt-1 text-xs text-muted-foreground">
												{match.triggerReason}
											</p>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Single "Show details" button for all criteria -->
		<div class="flex justify-center">
			<Button
				variant="ghost"
				size="sm"
				class="h-7 gap-1.5 text-xs text-muted-foreground"
				onclick={() => (expanded = !expanded)}
			>
				<ChevronDown
					class="size-3.5 transition-transform {expanded ? 'rotate-180' : ''}"
				/>
				{expanded ? 'Hide' : 'Show'} details
			</Button>
		</div>
	</div>
	</div>
{/if}
