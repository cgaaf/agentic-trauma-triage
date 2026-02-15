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

	const dash = "\u2014";

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
	<Sheet.Content side="right" class="w-full sm:max-w-xl overflow-y-auto">
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
			<div class="space-y-6 px-4 pb-4">
				<!-- Scenario -->
				<section>
					<h3 class="text-sm font-semibold">Scenario</h3>
					<div class="mt-2 rounded-md border p-4 space-y-2">
						<p class="text-sm">{example.mechanism}</p>
						{#if example.descriptors}
							<p class="text-muted-foreground text-sm">{example.descriptors}</p>
						{/if}
					</div>
				</section>

				<!-- Demographics -->
				<section>
					<h3 class="text-sm font-semibold">Demographics</h3>
					<div class="mt-2 grid grid-cols-3 gap-4 rounded-md border p-4">
						<div>
							<span class="text-muted-foreground text-xs">Age</span>
							<p class="text-sm font-mono">{example.age}</p>
						</div>
						<div>
							<span class="text-muted-foreground text-xs">Gender</span>
							<p class="text-sm">
								{#if example.gender}
									<Badge variant="outline">{example.gender}</Badge>
								{:else}
									{dash}
								{/if}
							</p>
						</div>
						<div>
							<span class="text-muted-foreground text-xs">Pregnancy</span>
							<p class="text-sm font-mono">
								{example.pregnancy_in_weeks !== null ? `${example.pregnancy_in_weeks}w` : dash}
							</p>
						</div>
					</div>
				</section>

				<!-- Vitals & Clinical -->
				<section>
					<h3 class="text-sm font-semibold">Vitals & Clinical</h3>
					<div class="mt-2 grid grid-cols-2 gap-4 rounded-md border p-4 sm:grid-cols-3">
						<div>
							<span class="text-muted-foreground text-xs">GCS</span>
							<p class="text-sm font-mono">{example.gcs ?? dash}</p>
						</div>
						<div>
							<span class="text-muted-foreground text-xs">SBP</span>
							<p class="text-sm font-mono">{example.systolic_bp ?? dash}</p>
						</div>
						<div>
							<span class="text-muted-foreground text-xs">HR</span>
							<p class="text-sm font-mono">{example.heart_rate ?? dash}</p>
						</div>
						<div>
							<span class="text-muted-foreground text-xs">RR</span>
							<p class="text-sm font-mono">{example.respiratory_rate ?? dash}</p>
						</div>
						<div>
							<span class="text-muted-foreground text-xs">SpO2</span>
							<p class="text-sm font-mono">
								{example.oxygen_saturation !== null ? `${example.oxygen_saturation}%` : dash}
							</p>
						</div>
						<div>
							<span class="text-muted-foreground text-xs">Airway</span>
							<p class="text-sm">
								{#if example.airway}
									<Badge variant="outline">{example.airway}</Badge>
								{:else}
									{dash}
								{/if}
							</p>
						</div>
						<div>
							<span class="text-muted-foreground text-xs">Breathing</span>
							<p class="text-sm">
								{#if example.breathing}
									<Badge variant="outline">{example.breathing}</Badge>
								{:else}
									{dash}
								{/if}
							</p>
						</div>
					</div>
				</section>

				<!-- Linked Criterion -->
				<section>
					<h3 class="text-sm font-semibold">Linked Criterion</h3>

					{#if example.criteria_id === null}
						<p class="text-muted-foreground mt-2 text-sm">No linked criterion</p>
					{:else if loading}
						<p class="text-muted-foreground mt-2 text-sm">Loading criterion...</p>
					{:else if fetchError}
						<p class="text-destructive mt-2 text-sm">{fetchError}</p>
					{:else if criterion}
						<div class="mt-2 rounded-md border p-4 space-y-3">
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
				</section>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
