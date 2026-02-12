<script lang="ts">
	import type { ExampleWithCriterion } from "$lib/types/database.js";
	import type { NullFilterState } from "$lib/types/database.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import TextSearchChip from "$lib/components/data-explorer/TextSearchChip.svelte";
	import ResultsCount from "$lib/components/data-explorer/ResultsCount.svelte";
	import ExamplesTable from "$lib/components/data-explorer/ExamplesTable.svelte";
	import ExampleCriterionSheet from "$lib/components/data-explorer/ExampleCriterionSheet.svelte";
	import VitalFilterChip from "$lib/components/data-explorer/VitalFilterChip.svelte";
	import CategoryFilterChip from "$lib/components/data-explorer/CategoryFilterChip.svelte";
	import NullFilterChip from "$lib/components/data-explorer/NullFilterChip.svelte";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import {
		parseFiltersFromUrl,
		filterExamples,
		buildFilterParams,
		buildUpdatedParams,
		countActiveFilters,
		defaultFilterState,
		VITAL_DEFAULTS,
		type NullFilterColumn,
		type VitalParamKey,
	} from "./examples-filters.js";

	let { data } = $props();

	// ─── URL is the source of truth ─────────────────────────────
	let filters = $derived(parseFiltersFromUrl(page.url.searchParams));
	let filteredExamples = $derived(filterExamples(data.examples, filters));
	let activeFilterCount = $derived(countActiveFilters(filters));

	// Category options
	const airwayOptions = [
		{ value: "patent", label: "patent" },
		{ value: "intubated", label: "intubated" },
		{ value: "extraglottic", label: "extraglottic" },
		{ value: "compromised", label: "compromised" },
	];

	const breathingOptions = [
		{ value: "Breathing Independently", label: "Breathing Independently" },
		{ value: "Bagging", label: "Bagging" },
		{ value: "Ventilator", label: "Ventilator" },
	];

	// ─── URL updater ────────────────────────────────────────────
	function navigate(params: URLSearchParams) {
		const query = params.toString();
		goto(query ? `?${query}` : page.url.pathname, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	}

	// ─── Discrete filter handlers (immediate URL update) ────────
	function setNullFilter(col: NullFilterColumn, value: NullFilterState) {
		navigate(
			buildUpdatedParams(page.url.searchParams, {
				nullFilters: { ...filters.nullFilters, [col]: value },
			}),
		);
	}

	function setVitalRange(key: VitalParamKey, range: [number, number]) {
		navigate(
			buildUpdatedParams(page.url.searchParams, {
				vitalRanges: { ...filters.vitalRanges, [key]: range },
			}),
		);
	}

	function setCategoryFilter(
		field: "airway" | "breathing",
		selected: string,
		nullState: NullFilterState,
	) {
		navigate(
			buildUpdatedParams(page.url.searchParams, {
				[field]: selected,
				nullFilters: { ...filters.nullFilters, [field]: nullState },
			}),
		);
	}

	// ─── Text inputs: local $state for responsive typing ────────
	// These are the ONLY local $state — needed because goto on every
	// keystroke is too slow. Initialized from URL, debounced to URL.
	let searchLocal = $state(parseFiltersFromUrl(page.url.searchParams).search);
	let criterionSearchLocal = $state(parseFiltersFromUrl(page.url.searchParams).criterionSearch);
	let descriptorsSearchLocal = $state(
		parseFiltersFromUrl(page.url.searchParams).descriptorsSearch,
	);

	let debounceTimeout: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const s = searchLocal;
		const cs = criterionSearchLocal;
		const ds = descriptorsSearchLocal;
		clearTimeout(debounceTimeout);
		debounceTimeout = setTimeout(() => {
			navigate(
				buildUpdatedParams(page.url.searchParams, {
					search: s,
					criterionSearch: cs,
					descriptorsSearch: ds,
				}),
			);
		}, 300);
		return () => clearTimeout(debounceTimeout);
	});

	// ─── Sheet state ────────────────────────────────────────────
	let sheetOpen = $state(false);
	let selectedExample = $state<ExampleWithCriterion | null>(null);

	function openSheet(example: ExampleWithCriterion) {
		selectedExample = example;
		sheetOpen = true;
	}

	// ─── Per-chip clear handlers ────────────────────────────────
	function clearNullFilter(col: NullFilterColumn) {
		if (col === "criteria_id") criterionSearchLocal = "";
		if (col === "descriptors") descriptorsSearchLocal = "";
		clearTimeout(debounceTimeout);
		navigate(
			buildUpdatedParams(page.url.searchParams, {
				nullFilters: { ...filters.nullFilters, [col]: "all" },
				...(col === "criteria_id" ? { criterionSearch: "" } : {}),
				...(col === "descriptors" ? { descriptorsSearch: "" } : {}),
			}),
		);
	}

	function clearVital(key: VitalParamKey, col: NullFilterColumn) {
		navigate(
			buildUpdatedParams(page.url.searchParams, {
				nullFilters: { ...filters.nullFilters, [col]: "all" },
				vitalRanges: { ...filters.vitalRanges, [key]: [...VITAL_DEFAULTS[key]] },
			}),
		);
	}

	function clearCategory(field: "airway" | "breathing") {
		navigate(
			buildUpdatedParams(page.url.searchParams, {
				[field]: "",
				nullFilters: { ...filters.nullFilters, [field]: "all" },
			}),
		);
	}

	function clearTextSearch() {
		searchLocal = "";
		clearTimeout(debounceTimeout);
		navigate(buildUpdatedParams(page.url.searchParams, { search: "" }));
	}

	// ─── Clear all filters ──────────────────────────────────────
	function clearFilters() {
		searchLocal = "";
		criterionSearchLocal = "";
		descriptorsSearchLocal = "";
		clearTimeout(debounceTimeout);
		navigate(buildFilterParams(defaultFilterState()));
	}
</script>

<svelte:head>
	<title>Examples Explorer</title>
</svelte:head>

<div class="container mx-auto max-w-[1400px] space-y-4 p-4">
	<h1 class="text-2xl font-bold tracking-tight">Examples Explorer</h1>

	<!-- Chip bar -->
	<div class="flex flex-wrap items-center gap-2">
		<NullFilterChip
			label="Criterion"
			nullState={filters.nullFilters.criteria_id}
			onnullchange={(v) => setNullFilter("criteria_id", v)}
			onclear={() => clearNullFilter("criteria_id")}
			bind:searchValue={criterionSearchLocal}
			searchPlaceholder="Search criteria…"
		/>
		<TextSearchChip
			label="Mechanism"
			placeholder="Search mechanism…"
			bind:value={searchLocal}
			onclear={clearTextSearch}
		/>
		<NullFilterChip
			label="Descriptors"
			nullState={filters.nullFilters.descriptors}
			onnullchange={(v) => setNullFilter("descriptors", v)}
			onclear={() => clearNullFilter("descriptors")}
			bind:searchValue={descriptorsSearchLocal}
			searchPlaceholder="Search descriptors…"
		/>
		<NullFilterChip
			label="Gender"
			nullState={filters.nullFilters.gender}
			onnullchange={(v) => setNullFilter("gender", v)}
			onclear={() => clearNullFilter("gender")}
		/>
		<VitalFilterChip
			label="GCS"
			min={3}
			max={15}
			nullState={filters.nullFilters.gcs}
			range={filters.vitalRanges.gcs}
			onnullchange={(v) => setNullFilter("gcs", v)}
			onrangechange={(r) => setVitalRange("gcs", r)}
			onclear={() => clearVital("gcs", "gcs")}
		/>
		<VitalFilterChip
			label="SBP"
			min={0}
			max={300}
			nullState={filters.nullFilters.systolic_bp}
			range={filters.vitalRanges.sbp}
			onnullchange={(v) => setNullFilter("systolic_bp", v)}
			onrangechange={(r) => setVitalRange("sbp", r)}
			onclear={() => clearVital("sbp", "systolic_bp")}
		/>
		<VitalFilterChip
			label="HR"
			min={0}
			max={250}
			nullState={filters.nullFilters.heart_rate}
			range={filters.vitalRanges.hr}
			onnullchange={(v) => setNullFilter("heart_rate", v)}
			onrangechange={(r) => setVitalRange("hr", r)}
			onclear={() => clearVital("hr", "heart_rate")}
		/>
		<VitalFilterChip
			label="RR"
			min={0}
			max={60}
			nullState={filters.nullFilters.respiratory_rate}
			range={filters.vitalRanges.rr}
			onnullchange={(v) => setNullFilter("respiratory_rate", v)}
			onrangechange={(r) => setVitalRange("rr", r)}
			onclear={() => clearVital("rr", "respiratory_rate")}
		/>
		<CategoryFilterChip
			label="Airway"
			options={airwayOptions}
			selected={filters.airway}
			nullState={filters.nullFilters.airway}
			onchange={(sel, ns) => setCategoryFilter("airway", sel, ns)}
			onclear={() => clearCategory("airway")}
		/>
		<CategoryFilterChip
			label="Breathing"
			options={breathingOptions}
			selected={filters.breathing}
			nullState={filters.nullFilters.breathing}
			onchange={(sel, ns) => setCategoryFilter("breathing", sel, ns)}
			onclear={() => clearCategory("breathing")}
		/>
		<VitalFilterChip
			label="SpO2"
			min={0}
			max={100}
			nullState={filters.nullFilters.oxygen_saturation}
			range={filters.vitalRanges.spo2}
			onnullchange={(v) => setNullFilter("oxygen_saturation", v)}
			onrangechange={(r) => setVitalRange("spo2", r)}
			onclear={() => clearVital("spo2", "oxygen_saturation")}
		/>
		<NullFilterChip
			label="Pregnancy"
			nullState={filters.nullFilters.pregnancy_in_weeks}
			onnullchange={(v) => setNullFilter("pregnancy_in_weeks", v)}
			onclear={() => clearNullFilter("pregnancy_in_weeks")}
		/>

		{#if activeFilterCount > 0}
			<Button variant="ghost" size="sm" class="h-7 text-xs" onclick={clearFilters}>
				Clear all
			</Button>
		{/if}
	</div>

	<ResultsCount filtered={filteredExamples.length} total={data.examples.length} />

	<ExamplesTable examples={filteredExamples} onrowclick={openSheet} />

	<ExampleCriterionSheet example={selectedExample} bind:open={sheetOpen} />
</div>
