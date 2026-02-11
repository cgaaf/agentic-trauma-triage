<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import type { CriteriaRow } from "$lib/types/database.js";

	let {
		criteria,
		onrowclick,
	}: {
		criteria: CriteriaRow[];
		onrowclick: (criterion: CriteriaRow) => void;
	} = $props();

	function levelVariant(level: string): "default" | "secondary" | "outline" | "destructive" {
		switch (level) {
			case "Level 1":
				return "destructive";
			case "Level 2":
				return "default";
			case "Level 3":
				return "secondary";
			default:
				return "outline";
		}
	}
</script>

<div class="overflow-x-auto rounded-md border">
	<Table.Root class="[&_td]:px-3 [&_th]:px-3">
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-10 border-r text-right">ID</Table.Head>
				<Table.Head class="max-w-[400px]">Description</Table.Head>
				<Table.Head class="w-24">Category</Table.Head>
				<Table.Head class="w-20 text-right">Age Min</Table.Head>
				<Table.Head class="w-20 text-right">Age Max</Table.Head>
				<Table.Head class="w-24">Level</Table.Head>
				<Table.Head class="max-w-[250px]">Notes</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each criteria as row (row.id)}
				<Table.Row
					class="cursor-pointer"
					onclick={() => onrowclick(row)}
				>
					<Table.Cell class="border-r text-right font-mono text-xs">{row.id}</Table.Cell>
					<Table.Cell class="max-w-[400px]">
						<div class="line-clamp-2 whitespace-normal">{row.description}</div>
					</Table.Cell>
					<Table.Cell class="text-xs">{row.category}</Table.Cell>
					<Table.Cell class="text-right font-mono text-xs">{row.age_min}</Table.Cell>
					<Table.Cell class="text-right font-mono text-xs">
						{row.age_max !== null ? row.age_max : "\u2014"}
					</Table.Cell>
					<Table.Cell>
						<Badge variant={levelVariant(row.activation_level)}>{row.activation_level}</Badge>
					</Table.Cell>
					<Table.Cell class="text-muted-foreground max-w-[250px] text-xs">
						<div class="line-clamp-2 whitespace-normal">{row.notes ?? "\u2014"}</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
