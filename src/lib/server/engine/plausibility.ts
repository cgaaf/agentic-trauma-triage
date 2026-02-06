import type { ExtractedFields, PlausibilityWarning } from '$lib/types/index.js';

const RANGES: Record<string, { min: number; max: number; label: string }> = {
	age: { min: 0, max: 120, label: 'Age' },
	sbp: { min: 20, max: 300, label: 'SBP' },
	hr: { min: 20, max: 300, label: 'HR' },
	rr: { min: 0, max: 80, label: 'RR' },
	gcs: { min: 3, max: 15, label: 'GCS' },
};

/** Check extracted values against plausible clinical ranges. Returns warnings (informational only). */
export function checkPlausibility(fields: ExtractedFields): PlausibilityWarning[] {
	const warnings: PlausibilityWarning[] = [];

	for (const [field, range] of Object.entries(RANGES)) {
		const value = fields[field as keyof ExtractedFields];
		if (typeof value !== 'number') continue;

		if (value < range.min || value > range.max) {
			warnings.push({
				field,
				value,
				message: `${range.label} ${value} is outside normal clinical range (${range.min}-${range.max})`,
			});
		}
	}

	return warnings;
}
