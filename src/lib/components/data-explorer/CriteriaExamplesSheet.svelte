<script lang="ts">
	import * as Sheet from "$lib/components/ui/sheet/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import type { CriteriaRow, ExampleRow } from "$lib/types/database.js";

	let {
		criterion,
		open = $bindable(false),
	}: {
		criterion: CriteriaRow | null;
		open: boolean;
	} = $props();

	let examples = $state<ExampleRow[]>([]);
	let loading = $state(false);
	let fetchError = $state("");

	async function fetchExamples(id: number) {
		loading = true;
		fetchError = "";
		examples = [];
		try {
			const res = await fetch(`/api/criteria/${id}/examples`);
			if (!res.ok) throw new Error("Failed to fetch examples");
			const data = await res.json();
			examples = data.examples;
		} catch (e) {
			fetchError = e instanceof Error ? e.message : "Failed to fetch";
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open && criterion) {
			fetchExamples(criterion.id);
		}
	});
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-full sm:max-w-xl overflow-y-auto">
		<Sheet.Header>
			<Sheet.Title>
				{#if criterion}
					Criterion #{criterion.id}
				{:else}
					Criterion Details
				{/if}
			</Sheet.Title>
			<Sheet.Description>
				{#if criterion}
					{criterion.description}
				{/if}
			</Sheet.Description>
		</Sheet.Header>

		{#if criterion}
			<div class="space-y-4 px-4 pb-4">
				<div class="flex flex-wrap gap-2">
					<Badge variant="outline">{criterion.category}</Badge>
					<Badge variant="outline">
						Age {criterion.age_min}{criterion.age_max !== null ? ` - ${criterion.age_max}` : "+"}
					</Badge>
					<Badge variant={criterion.activation_level === "Level 1" ? "destructive" : criterion.activation_level === "Level 2" ? "default" : "secondary"}>
						{criterion.activation_level}
					</Badge>
				</div>

				{#if criterion.notes}
					<p class="text-muted-foreground text-sm">{criterion.notes}</p>
				{/if}

				<h3 class="text-sm font-semibold">Linked Examples</h3>

				{#if loading}
					<p class="text-muted-foreground text-sm">Loading examples...</p>
				{:else if fetchError}
					<p class="text-destructive text-sm">{fetchError}</p>
				{:else if examples.length === 0}
					<p class="text-muted-foreground text-sm">No linked examples</p>
				{:else}
					<div class="overflow-x-auto rounded-md border">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head class="w-12 text-right">ID</Table.Head>
									<Table.Head>Mechanism</Table.Head>
									<Table.Head class="w-12">Age</Table.Head>
									<Table.Head class="w-16">GCS</Table.Head>
									<Table.Head class="w-16">SBP</Table.Head>
									<Table.Head class="w-16">HR</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each examples as ex (ex.id)}
									<Table.Row>
										<Table.Cell class="text-right font-mono text-xs">{ex.id}</Table.Cell>
										<Table.Cell class="text-xs">{ex.mechanism}</Table.Cell>
										<Table.Cell class="font-mono text-xs">{ex.age}</Table.Cell>
										<Table.Cell class="font-mono text-xs">{ex.gcs ?? "\u2014"}</Table.Cell>
										<Table.Cell class="font-mono text-xs">{ex.systolic_bp ?? "\u2014"}</Table.Cell>
										<Table.Cell class="font-mono text-xs">{ex.heart_rate ?? "\u2014"}</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				{/if}
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
