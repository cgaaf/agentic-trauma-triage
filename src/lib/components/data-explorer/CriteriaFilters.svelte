<script lang="ts">
	import MultiSelectChips from "./MultiSelectChips.svelte";
	import { Input } from "$lib/components/ui/input/index.js";

	let {
		levels = $bindable(),
		categories = $bindable(),
		age = $bindable(),
		search = $bindable(),
	}: {
		levels: string[];
		categories: string[];
		age: number | null;
		search: string;
	} = $props();

	let ageInput = $state(age !== null ? String(age) : "");

	function handleAgeInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const val = target.value.trim();
		if (val === "") {
			age = null;
			ageInput = "";
		} else {
			const parsed = parseInt(val, 10);
			if (!Number.isNaN(parsed) && parsed >= 0) {
				age = parsed;
				ageInput = val;
			}
		}
	}
</script>

<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<MultiSelectChips
		label="Activation Level"
		options={["Level 1", "Level 2", "Level 3"]}
		bind:selected={levels}
	/>
	<MultiSelectChips
		label="Category"
		options={["Adult", "Pediatric", "Geriatric"]}
		bind:selected={categories}
	/>
	<div class="space-y-1.5">
		<label for="criteria-age" class="text-muted-foreground text-sm font-medium">Patient Age</label>
		<Input
			id="criteria-age"
			type="number"
			placeholder="e.g. 25"
			min={0}
			max={120}
			value={ageInput}
			oninput={handleAgeInput}
		/>
	</div>
	<div class="space-y-1.5">
		<label for="criteria-search" class="text-muted-foreground text-sm font-medium">Search Description</label>
		<Input
			id="criteria-search"
			type="text"
			placeholder="e.g. fracture"
			bind:value={search}
		/>
	</div>
</div>
