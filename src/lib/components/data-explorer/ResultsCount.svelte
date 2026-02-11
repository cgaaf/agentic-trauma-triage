<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	let { filtered, total, hasActiveFilters, onclear }: {
		filtered: number;
		total: number;
		hasActiveFilters: boolean;
		onclear: () => void;
	} = $props();
</script>

<div class="flex items-center justify-between">
	<p class="text-muted-foreground text-sm">
		Showing <span class="text-foreground font-medium">{filtered}</span> of {total} results
	</p>
	{#if hasActiveFilters}
		<Button variant="ghost" size="sm" onclick={onclear}>
			Clear all filters
		</Button>
	{/if}
</div>
