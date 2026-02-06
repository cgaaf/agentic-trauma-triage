<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { SendHorizonal } from '@lucide/svelte';

	let {
		value = $bindable(''),
		loading = false,
		onsubmit,
	}: {
		value?: string;
		loading?: boolean;
		onsubmit?: (report: string) => void;
	} = $props();

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
