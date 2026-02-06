<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Stethoscope, ClipboardList, Zap } from '@lucide/svelte';
</script>

<Card.Root class="border-dashed">
	<Card.Header>
		<Card.Title class="text-lg">How it works</Card.Title>
		<Card.Description>Submit a free-text EMS trauma report to receive a triage evaluation</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="grid gap-4 sm:grid-cols-3">
			<div class="flex flex-col items-center gap-2 text-center">
				<div class="flex size-10 items-center justify-center rounded-full bg-muted">
					<ClipboardList class="size-5 text-muted-foreground" />
				</div>
				<p class="text-sm font-medium">Extract</p>
				<p class="text-xs text-muted-foreground">Clinical fields are extracted from your narrative</p>
			</div>
			<div class="flex flex-col items-center gap-2 text-center">
				<div class="flex size-10 items-center justify-center rounded-full bg-muted">
					<Stethoscope class="size-5 text-muted-foreground" />
				</div>
				<p class="text-sm font-medium">Evaluate</p>
				<p class="text-xs text-muted-foreground">137 criteria are checked against the patient data</p>
			</div>
			<div class="flex flex-col items-center gap-2 text-center">
				<div class="flex size-10 items-center justify-center rounded-full bg-muted">
					<Zap class="size-5 text-muted-foreground" />
				</div>
				<p class="text-sm font-medium">Activate</p>
				<p class="text-xs text-muted-foreground">A recommended trauma activation level is determined</p>
			</div>
		</div>
	</Card.Content>
</Card.Root>
