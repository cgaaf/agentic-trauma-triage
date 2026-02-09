<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { ShieldAlert } from '@lucide/svelte';
	import { goto } from '$app/navigation';

	let { open = $bindable(false) }: { open: boolean } = $props();

	function handleAccept() {
		localStorage.setItem('disclaimer-accepted', 'true');
		open = false;
	}

	function handleDecline() {
		open = false;
		goto('/research-info');
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content class="sm:max-w-lg sm:gap-5 sm:p-8">
		<div class="flex flex-col items-center gap-3 text-center">
			<div class="rounded-full bg-amber-100 p-3 dark:bg-amber-950">
				<ShieldAlert class="size-6 text-amber-600 dark:text-amber-400" />
			</div>
			<AlertDialog.Title>Research Project — Not for Clinical Use</AlertDialog.Title>
			<AlertDialog.Description class="text-sm text-muted-foreground">
				This tool is an <strong>academic research prototype</strong> developed for educational and
				research purposes only.
			</AlertDialog.Description>
		</div>
		<ul class="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
			<li>Not HIPAA compliant — no data encryption or access controls</li>
			<li>Not FDA approved — not validated for clinical decisions</li>
			<li>No audit trail — inputs are not stored or logged</li>
		</ul>
		<p class="text-center text-sm font-medium text-muted-foreground">
			Do not enter real patient data or protected health information (PHI). Use only fictional or
			synthetic scenarios.
		</p>
		<div class="flex flex-col gap-2">
			<AlertDialog.Action class="w-full" onclick={handleAccept}>I Understand — No PHI</AlertDialog.Action>
			<AlertDialog.Cancel class="w-full" onclick={handleDecline}>Decline</AlertDialog.Cancel>
		</div>
	</AlertDialog.Content>
</AlertDialog.Root>
