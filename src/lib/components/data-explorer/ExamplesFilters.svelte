<script lang="ts">
	import VitalRangeSlider from "./VitalRangeSlider.svelte";
	import TriStateToggle from "./TriStateToggle.svelte";
	import { Input } from "$lib/components/ui/input/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import type { NullFilterState } from "$lib/types/database.js";

	let {
		gcsActive = $bindable(),
		gcsRange = $bindable(),
		sbpActive = $bindable(),
		sbpRange = $bindable(),
		hrActive = $bindable(),
		hrRange = $bindable(),
		rrActive = $bindable(),
		rrRange = $bindable(),
		spo2Active = $bindable(),
		spo2Range = $bindable(),
		airway = $bindable(),
		breathing = $bindable(),
		search = $bindable(),
		nullFilters = $bindable(),
	}: {
		gcsActive: boolean;
		gcsRange: [number, number];
		sbpActive: boolean;
		sbpRange: [number, number];
		hrActive: boolean;
		hrRange: [number, number];
		rrActive: boolean;
		rrRange: [number, number];
		spo2Active: boolean;
		spo2Range: [number, number];
		airway: string;
		breathing: string;
		search: string;
		nullFilters: Record<string, NullFilterState>;
	} = $props();

	const nullFilterColumns = [
		"gender",
		"descriptors",
		"gcs",
		"systolic_bp",
		"heart_rate",
		"respiratory_rate",
		"oxygen_saturation",
		"pregnancy_in_weeks",
		"airway",
		"breathing",
		"criteria_id",
	];

	const nullFilterLabels: Record<string, string> = {
		gender: "Gender",
		descriptors: "Descriptors",
		gcs: "GCS",
		systolic_bp: "SBP",
		heart_rate: "HR",
		respiratory_rate: "RR",
		oxygen_saturation: "SpO2",
		pregnancy_in_weeks: "Pregnancy",
		airway: "Airway",
		breathing: "Breathing",
		criteria_id: "Criterion",
	};
</script>

<div class="space-y-6">
	<!-- Vital Range Sliders -->
	<div>
		<h3 class="text-foreground mb-3 text-sm font-semibold">Vital Sign Ranges</h3>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<VitalRangeSlider label="GCS" min={3} max={15} bind:active={gcsActive} bind:value={gcsRange} />
			<VitalRangeSlider label="Systolic BP" min={0} max={300} bind:active={sbpActive} bind:value={sbpRange} />
			<VitalRangeSlider label="Heart Rate" min={0} max={250} bind:active={hrActive} bind:value={hrRange} />
			<VitalRangeSlider label="Respiratory Rate" min={0} max={60} bind:active={rrActive} bind:value={rrRange} />
			<VitalRangeSlider label="SpO2" min={0} max={100} bind:active={spo2Active} bind:value={spo2Range} />
		</div>
	</div>

	<!-- Select Dropdowns + Text Search -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<div class="space-y-1.5">
			<span class="text-muted-foreground text-sm font-medium">Airway</span>
			<Select.Root type="single" value={airway} onValueChange={(v) => (airway = v ?? "")}>
				<Select.Trigger class="w-full">
					{airway || "(All)"}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">(All)</Select.Item>
					<Select.Item value="patent">patent</Select.Item>
					<Select.Item value="intubated">intubated</Select.Item>
					<Select.Item value="extraglottic">extraglottic</Select.Item>
					<Select.Item value="compromised">compromised</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>
		<div class="space-y-1.5">
			<span class="text-muted-foreground text-sm font-medium">Breathing</span>
			<Select.Root type="single" value={breathing} onValueChange={(v) => (breathing = v ?? "")}>
				<Select.Trigger class="w-full">
					{breathing || "(All)"}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">(All)</Select.Item>
					<Select.Item value="Breathing Independently">Breathing Independently</Select.Item>
					<Select.Item value="Bagging">Bagging</Select.Item>
					<Select.Item value="Ventilator">Ventilator</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>
		<div class="space-y-1.5">
			<label for="examples-search" class="text-muted-foreground text-sm font-medium">Search Text</label>
			<Input
				id="examples-search"
				type="text"
				placeholder="Search mechanism + descriptors"
				bind:value={search}
			/>
		</div>
	</div>

	<!-- Nullable Column Tri-State Filters -->
	<div>
		<h3 class="text-foreground mb-3 text-sm font-semibold">Nullable Column Filters</h3>
		<div class="flex flex-wrap gap-3">
			{#each nullFilterColumns as col (col)}
				<TriStateToggle
					label={nullFilterLabels[col]}
					value={nullFilters[col]}
					onchange={(v) => {
						nullFilters = { ...nullFilters, [col]: v };
					}}
				/>
			{/each}
		</div>
	</div>
</div>
