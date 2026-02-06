import type { CriterionMatch, FinalActivationLevel } from '$lib/types/index.js';

const LEVEL_PRIORITY: Record<string, number> = {
	'Level 1': 1,
	'Level 2': 2,
	'Level 3': 3,
};

/** Merge and deduplicate matches from deterministic + hybrid + LLM evaluation phases. */
export function mergeMatches(...matchArrays: CriterionMatch[][]): CriterionMatch[] {
	const seen = new Map<number, CriterionMatch>();

	for (const arr of matchArrays) {
		for (const match of arr) {
			const existing = seen.get(match.criterionId);
			if (!existing) {
				seen.set(match.criterionId, match);
			} else if (existing.source === 'llm' && match.source === 'deterministic') {
				// Prefer deterministic source when both exist
				seen.set(match.criterionId, match);
			}
		}
	}

	return Array.from(seen.values());
}

/** Determine the highest activation level from a set of matches. */
export function determineActivationLevel(matches: CriterionMatch[]): FinalActivationLevel {
	if (matches.length === 0) return 'Standard Triage';

	let highest = 'Standard Triage' as FinalActivationLevel;
	let highestPriority = Infinity;

	for (const match of matches) {
		const priority = LEVEL_PRIORITY[match.activationLevel];
		if (priority !== undefined && priority < highestPriority) {
			highestPriority = priority;
			highest = match.activationLevel;
		}
	}

	return highest;
}

/** Build a justification string for the activation level. */
export function buildJustification(level: FinalActivationLevel, matches: CriterionMatch[]): string {
	if (level === 'Standard Triage') {
		return 'No trauma activation criteria were met based on the provided information.';
	}

	const levelMatches = matches.filter((m) => m.activationLevel === level);
	const reasons = levelMatches.map((m) => m.triggerReason);
	return `${level} activation recommended based on: ${reasons.join('; ')}.`;
}
