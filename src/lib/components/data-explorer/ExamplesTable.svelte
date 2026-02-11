<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import type { ExampleWithCriterion } from "$lib/types/database.js";

	let {
		examples,
		onrowclick,
	}: {
		examples: ExampleWithCriterion[];
		onrowclick: (example: ExampleWithCriterion) => void;
	} = $props();

	const dash = "\u2014";
</script>

<div class="overflow-x-auto rounded-md border">
	<Table.Root class="[&_td]:px-3 [&_th]:px-3">
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-10 border-r text-right">ID</Table.Head>
				<Table.Head class="min-w-[200px] max-w-[300px]">Criterion</Table.Head>
				<Table.Head class="min-w-[150px] max-w-[200px]">Mechanism</Table.Head>
				<Table.Head class="min-w-[150px] max-w-[200px]">Descriptors</Table.Head>
				<Table.Head class="w-12">Age</Table.Head>
				<Table.Head class="w-16">Gender</Table.Head>
				<Table.Head class="w-12">GCS</Table.Head>
				<Table.Head class="w-12">SBP</Table.Head>
				<Table.Head class="w-12">HR</Table.Head>
				<Table.Head class="w-12">RR</Table.Head>
				<Table.Head class="w-16">Airway</Table.Head>
				<Table.Head class="w-20">Breathing</Table.Head>
				<Table.Head class="w-12">SpO2</Table.Head>
				<Table.Head class="w-16">Pregnancy</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each examples as row (row.id)}
				<Table.Row
					class="cursor-pointer"
					onclick={() => onrowclick(row)}
				>
					<Table.Cell class="border-r text-right font-mono text-xs">{row.id}</Table.Cell>
					<Table.Cell class="max-w-[300px] text-xs">
						<div class="line-clamp-2 whitespace-normal">
							{#if row.criteria}
								{row.criteria.description}
							{:else}
								<span class="text-muted-foreground italic">Unlinked</span>
							{/if}
						</div>
					</Table.Cell>
					<Table.Cell class="max-w-[200px] text-xs">
						<div class="line-clamp-2 whitespace-normal">{row.mechanism}</div>
					</Table.Cell>
					<Table.Cell class="max-w-[200px] text-xs">
						<div class="line-clamp-2 whitespace-normal">{row.descriptors ?? dash}</div>
					</Table.Cell>
					<Table.Cell class="font-mono text-xs">{row.age}</Table.Cell>
					<Table.Cell class="text-xs">{row.gender ?? dash}</Table.Cell>
					<Table.Cell class="font-mono text-xs">{row.gcs ?? dash}</Table.Cell>
					<Table.Cell class="font-mono text-xs">{row.systolic_bp ?? dash}</Table.Cell>
					<Table.Cell class="font-mono text-xs">{row.heart_rate ?? dash}</Table.Cell>
					<Table.Cell class="font-mono text-xs">{row.respiratory_rate ?? dash}</Table.Cell>
					<Table.Cell class="text-xs">{row.airway ?? dash}</Table.Cell>
					<Table.Cell class="text-xs">{row.breathing ?? dash}</Table.Cell>
					<Table.Cell class="font-mono text-xs">{row.oxygen_saturation ?? dash}</Table.Cell>
					<Table.Cell class="font-mono text-xs">
						{row.pregnancy_in_weeks !== null ? `${row.pregnancy_in_weeks}w` : dash}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
