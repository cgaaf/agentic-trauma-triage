<script lang="ts">
	import { Toggle } from "$lib/components/ui/toggle/index.js";

	let {
		label,
		options,
		selected = $bindable(),
	}: {
		label: string;
		options: string[];
		selected: string[];
	} = $props();
</script>

<div class="space-y-1.5">
	<span class="text-muted-foreground text-sm font-medium">{label}</span>
	<div class="flex flex-wrap gap-1.5">
		{#each options as option (option)}
			<Toggle
				variant="outline"
				size="sm"
				pressed={selected.includes(option)}
				onPressedChange={(pressed) => {
					if (pressed) {
						selected = [...selected, option];
					} else {
						selected = selected.filter((s) => s !== option);
					}
				}}
			>
				{option}
			</Toggle>
		{/each}
	</div>
</div>
