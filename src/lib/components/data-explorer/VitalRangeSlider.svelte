<script lang="ts">
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { Slider } from "$lib/components/ui/slider/index.js";

	let {
		label,
		min,
		max,
		step = 1,
		active = $bindable(false),
		value = $bindable<[number, number]>([0, 0]),
	}: {
		label: string;
		min: number;
		max: number;
		step?: number;
		active: boolean;
		value: [number, number];
	} = $props();
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<span class="text-muted-foreground text-sm font-medium">{label}</span>
		<Switch
			bind:checked={active}
			onCheckedChange={(checked) => {
				if (checked) {
					value = [min, max];
				}
			}}
		/>
	</div>
	{#if active}
		<Slider type="multiple" bind:value {min} {max} {step} />
		<div class="text-muted-foreground flex justify-between text-xs">
			<span>{value[0]}</span>
			<span>{value[1]}</span>
		</div>
	{/if}
</div>
