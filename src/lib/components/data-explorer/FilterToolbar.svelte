<script lang="ts">
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";

	let {
		filtered,
		total,
		activeFilterCount,
		open = $bindable(),
		onclearall,
	}: {
		filtered: number;
		total: number;
		activeFilterCount: number;
		open: boolean;
		onclearall?: () => void;
	} = $props();
</script>

<div class="flex items-end justify-between">
	<p class="text-muted-foreground text-sm">
		Showing <span class="text-foreground font-medium">{filtered}</span> of {total} results
	</p>
	<div class="flex items-center gap-2">
		{#if activeFilterCount > 0}
			<Badge variant="secondary">{activeFilterCount} active</Badge>
			<Button variant="ghost" size="sm" class="h-7 text-xs" onclick={onclearall}>
				Clear all
			</Button>
		{/if}
		<Button variant="outline" size="sm" onclick={() => (open = !open)}>
			Filters
			{#if open}
				<ChevronUp class="ml-1 size-4" />
			{:else}
				<ChevronDown class="ml-1 size-4" />
			{/if}
		</Button>
	</div>
</div>
