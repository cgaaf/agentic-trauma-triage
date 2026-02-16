<script lang="ts">
	import type { NullFilterState } from "$lib/types/database.js";

	let {
		label,
		value = $bindable(),
		onchange,
	}: {
		label: string;
		value: NullFilterState;
		onchange?: (value: NullFilterState) => void;
	} = $props();

	function set(v: NullFilterState) {
		value = v;
		onchange?.(v);
	}
</script>

<div class="space-y-1.5">
	<span class="text-muted-foreground text-sm font-medium">{label}</span>
	<div class="border-input inline-flex rounded-md border">
		<button
			type="button"
			class="rounded-l-[calc(var(--radius)-1px)] px-2.5 py-1 text-xs font-medium transition-colors {value ===
			'all'
				? 'bg-accent text-accent-foreground'
				: 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}"
			onclick={() => set("all")}
		>
			All
		</button>
		<button
			type="button"
			class="border-input border-x px-2.5 py-1 text-xs font-medium transition-colors {value ===
			'has_value'
				? 'bg-accent text-accent-foreground'
				: 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}"
			onclick={() => set("has_value")}
		>
			Has value
		</button>
		<button
			type="button"
			class="rounded-r-[calc(var(--radius)-1px)] px-2.5 py-1 text-xs font-medium transition-colors {value ===
			'is_empty'
				? 'bg-accent text-accent-foreground'
				: 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}"
			onclick={() => set("is_empty")}
		>
			Is empty
		</button>
	</div>
</div>
