<script lang="ts">
	import * as Sheet from "$lib/components/ui/sheet/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import type { ExampleWithCriterion, CriteriaRow } from "$lib/types/database.js";

	let {
		example,
		open = $bindable(false),
	}: {
		example: ExampleWithCriterion | null;
		open: boolean;
	} = $props();

	let criterion = $state<CriteriaRow | null>(null);
	let loading = $state(false);
	let fetchError = $state("");

	async function fetchCriterion(exampleId: number) {
		loading = true;
		fetchError = "";
		criterion = null;
		try {
			const res = await fetch(`/api/examples/${exampleId}/criterion`);
			if (!res.ok) throw new Error("Failed to fetch criterion");
			const data = await res.json();
			criterion = data.criterion;
		} catch (e) {
			fetchError = e instanceof Error ? e.message : "Failed to fetch";
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open && example && example.criteria_id !== null) {
			fetchCriterion(example.id);
		}
	});
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-full sm:max-w-lg overflow-y-auto">
		<Sheet.Header>
			<Sheet.Title>
				{#if example}
					Example #{example.id}
				{:else}
					Example Details
				{/if}
			</Sheet.Title>
			<Sheet.Description>
				{#if example}
					{example.mechanism}
				{/if}
			</Sheet.Description>
		</Sheet.Header>

		{#if example}
			<div class="space-y-4 px-4 pb-4">
				<h3 class="text-sm font-semibold">Linked Criterion</h3>

				{#if example.criteria_id === null}
					<p class="text-muted-foreground text-sm">No linked criterion</p>
				{:else if loading}
					<p class="text-muted-foreground text-sm">Loading criterion...</p>
				{:else if fetchError}
					<p class="text-destructive text-sm">{fetchError}</p>
				{:else if criterion}
					<div class="rounded-md border p-4 space-y-3">
						<div class="flex flex-wrap gap-2">
							<Badge variant="outline">#{criterion.id}</Badge>
							<Badge variant="outline">{criterion.category}</Badge>
							<Badge variant="outline">
								Age {criterion.age_min}{criterion.age_max !== null ? ` - ${criterion.age_max}` : "+"}
							</Badge>
							<Badge variant={criterion.activation_level === "Level 1" ? "destructive" : criterion.activation_level === "Level 2" ? "default" : "secondary"}>
								{criterion.activation_level}
							</Badge>
						</div>
						<p class="text-sm">{criterion.description}</p>
						{#if criterion.notes}
							<p class="text-muted-foreground text-xs">{criterion.notes}</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
