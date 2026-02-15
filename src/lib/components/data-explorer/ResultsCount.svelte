<script lang="ts">
	let { filtered, total }: {
		filtered: number;
		total: number;
	} = $props();
</script>

<p class="text-muted-foreground text-sm">
	Showing <span class="text-foreground font-medium">{filtered}</span> of {total} results
</p>
