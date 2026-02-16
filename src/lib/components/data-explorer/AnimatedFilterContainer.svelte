<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		open,
		children,
	}: {
		open: boolean;
		children: Snippet;
	} = $props();
</script>

<div
	class="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
	style:grid-template-rows={open ? "1fr" : "0fr"}
	style:opacity={open ? 1 : 0}
>
	<div class="overflow-hidden">
		{@render children()}
	</div>
</div>
