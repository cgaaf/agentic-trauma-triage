<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Slider } from "$lib/components/ui/slider/index.js";
	import TriStateToggle from "./TriStateToggle.svelte";
	import type { NullFilterState } from "$lib/types/database.js";

	let {
		label,
		min,
		max,
		step = 1,
		nullState = $bindable(),
		range = $bindable(),
	}: {
		label: string;
		min: number;
		max: number;
		step?: number;
		nullState: NullFilterState;
		range: [number, number];
	} = $props();

	let active = $derived(nullState !== "all");

	let chipLabel = $derived.by(() => {
		if (nullState === "is_empty") return `${label}: empty`;
		if (nullState === "has_value") {
			if (range[0] === min && range[1] === max) return `${label}: any`;
			return `${label}: ${range[0]}–${range[1]}`;
		}
		return label;
	});

	function onTriStateChange(v: NullFilterState) {
		if (v === "has_value" && nullState !== "has_value") {
			range = [min, max];
		}
		nullState = v;
	}
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				variant={active ? "secondary" : "outline"}
				size="sm"
				class="h-7 gap-1 text-xs"
				{...props}
			>
				{#if active}
					<span class="bg-primary size-1.5 rounded-full"></span>
				{/if}
				{chipLabel}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-64" align="start">
		<TriStateToggle {label} value={nullState} onchange={onTriStateChange} />
		{#if nullState === "has_value"}
			<Separator class="my-3" />
			<div class="space-y-2">
				<Slider type="multiple" bind:value={range} {min} {max} {step} />
				<div class="text-muted-foreground flex justify-between text-xs">
					<span>{range[0]}</span>
					<span>{range[1]}</span>
				</div>
			</div>
		{/if}
	</Popover.Content>
</Popover.Root>
