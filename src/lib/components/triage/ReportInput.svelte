<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { SendHorizonal, FileText, ChevronDown } from '@lucide/svelte';

	let {
		value = $bindable(''),
		loading = false,
		collapsed = false,
		onsubmit,
	}: {
		value?: string;
		loading?: boolean;
		collapsed?: boolean;
		onsubmit?: (report: string) => void;
	} = $props();

	let userExpanded = $state(false);
	let isCollapsed = $derived(collapsed && !userExpanded);

	$effect(() => {
		if (!collapsed) {
			userExpanded = false;
		}
	});

	function handleSubmit() {
		if (value.trim() && onsubmit) {
			onsubmit(value.trim());
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

{#if isCollapsed}
	<button
		type="button"
		class="flex w-full items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
		onclick={() => (userExpanded = true)}
	>
		<FileText class="size-4 shrink-0 text-muted-foreground" />
		<span class="flex-1 truncate text-sm text-muted-foreground">
			{value.length > 80 ? value.slice(0, 80) + '...' : value}
		</span>
		<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
	</button>
{:else}
	<div class="space-y-3">
		<div class="text-sm text-muted-foreground space-y-1">
			<p><strong class="text-foreground">Required:</strong> Age (triage will be rejected without it)</p>
			<p>
				<strong class="text-foreground">For complete triage, include:</strong> Systolic Blood Pressure (SBP),
				Heart Rate (HR), Respiratory Rate (RR), Glasgow Coma Scale (GCS), Airway status, Breathing
				status, Mechanism of injury, Injuries
			</p>
		</div>

		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div onkeydown={handleKeydown} role="form">
			<Textarea
				bind:value
				placeholder="Enter EMS trauma report..."
				rows={6}
				class="resize-y text-base"
				disabled={loading}
			/>
		</div>

		<div class="flex items-center justify-between">
			<p class="text-xs text-muted-foreground">
				Press <kbd class="rounded border bg-muted px-1.5 py-0.5 text-xs">Ctrl</kbd>+<kbd
					class="rounded border bg-muted px-1.5 py-0.5 text-xs">Enter</kbd
				> to submit
			</p>
			<Button onclick={handleSubmit} disabled={loading || !value.trim()}>
				<SendHorizonal class="size-4" />
				Evaluate
			</Button>
		</div>
	</div>
{/if}
