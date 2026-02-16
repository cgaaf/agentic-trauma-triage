# Examples Explorer — `/examples`

## Overview

Read-only data exploration route for browsing all 160 example EMS scenarios stored in the Supabase `examples` table. Provides rich client-side filtering (including vital sign range sliders, nullable column tri-state filters, and text search) with URL-persisted filter state and cross-linking to the related criterion via a sheet overlay.

---

## Data Source

- **Table**: `public.examples` (160 rows) joined with `public.criteria` for criterion description
- **Load method**: SvelteKit `+page.server.ts` load function via Supabase server client
- **Join**: Left join on `examples.criteria_id = criteria.id` to get `criteria.description`

---

## Table

| Column               | Display     | Notes                                                               |
| -------------------- | ----------- | ------------------------------------------------------------------- |
| `id`                 | ID          | Right-aligned integer                                               |
| `criteria_id`        | Criterion   | Shows `criteria.description` as clickable link; "Unlinked" for NULL |
| `mechanism`          | Mechanism   | Full text                                                           |
| `descriptors`        | Descriptors | Full text or "—" for NULL                                           |
| `age`                | Age         | Integer                                                             |
| `gender`             | Gender      | male/female or "—" for NULL                                         |
| `gcs`                | GCS         | Integer or "—"                                                      |
| `systolic_bp`        | SBP         | Integer or "—"                                                      |
| `heart_rate`         | HR          | Integer or "—"                                                      |
| `respiratory_rate`   | RR          | Integer or "—"                                                      |
| `airway`             | Airway      | Text or "—"                                                         |
| `breathing`          | Breathing   | Text or "—"                                                         |
| `oxygen_saturation`  | SpO2        | Integer or "—"                                                      |
| `pregnancy_in_weeks` | Pregnancy   | Integer or "—"                                                      |

- Horizontal scroll on mobile via overflow-x container
- No client-side sorting (static order by id)

---

## Filter Panel

Collapsible panel above the table, same pattern as `/criteria`:

- **Collapsed state**: Count badge with number of active filters
- **Expanded state**: All filter controls
- **Header**: "Showing X of Y results" + "Clear all"

### Filters

#### Vital Sign Range Sliders (5 sliders)

Each vital slider is **inactive by default** — user must toggle it on via a Switch.

| Vital            | Min | Max | Step |
| ---------------- | --- | --- | ---- |
| GCS              | 3   | 15  | 1    |
| Systolic BP      | 0   | 300 | 1    |
| Heart Rate       | 0   | 250 | 1    |
| Respiratory Rate | 0   | 60  | 1    |
| SpO2             | 0   | 100 | 1    |

**Behavior**:

- **Inactive** (default): No filtering on this vital; rows with NULL values included
- **Toggle on**: Slider initializes to full range `[min, max]` and becomes interactive
- **Active**: Dual-thumb range slider — rows must have the vital value within `[low, high]`
- **Active sliders exclude NULLs** for that field (since NULL can't be compared)
- **Toggle off**: Removes filter, NULLs included again

#### Airway — Select dropdown

- Options: (All), patent, intubated, extraglottic, compromised
- "(All)" = no filter

#### Breathing — Select dropdown

- Options: (All), Breathing Independently, Bagging, Ventilator
- "(All)" = no filter

#### Nullable Column Tri-State Filters

Per-column toggle with three states: **All** / **Has value** / **Is empty**

Applies to: `gender`, `descriptors`, `gcs`, `systolic_bp`, `heart_rate`, `respiratory_rate`, `oxygen_saturation`, `pregnancy_in_weeks`, `airway`, `breathing`, `criteria_id`

- **All** (default): No filtering on nullability
- **Has value**: Only rows where column is NOT NULL
- **Is empty**: Only rows where column IS NULL

#### Free Text Search

- Searches across `mechanism` + `descriptors` columns
- Case-insensitive substring match
- Debounced input (300ms)

---

## URL State

All filters serialize to query parameters:

```
/examples?gcs=3,15&sbp=60,200&airway=patent&search=mvc&null_gender=has_value
```

| Parameter   | Type                      | Example                   |
| ----------- | ------------------------- | ------------------------- |
| `gcs`       | `min,max`                 | `3,15`                    |
| `sbp`       | `min,max`                 | `60,200`                  |
| `hr`        | `min,max`                 | `40,180`                  |
| `rr`        | `min,max`                 | `10,30`                   |
| `spo2`      | `min,max`                 | `90,100`                  |
| `airway`    | String                    | `patent`                  |
| `breathing` | String                    | `Breathing+Independently` |
| `search`    | String                    | `mvc`                     |
| `null_*`    | `has_value` or `is_empty` | `null_gender=has_value`   |

- Vital ranges only appear in URL when the slider is active
- "Clear all" removes all query params

---

## Cross-Link Sheet

Clicking a criterion description cell in the table opens a right-side sheet showing:

1. **Criterion details** (id, description, level, category, age range, notes)
2. Loaded via API endpoint

### API Endpoint

`GET /api/examples/[id]/criterion`

Returns JSON:

```json
{
  "example": { ... },
  "criterion": { ... } | null
}
```

- Fetches the example by ID + its linked criterion (if `criteria_id` is not NULL)
- Sheet shows loading state while fetching
- If no linked criterion (`criteria_id` is NULL), shows "No linked criterion"
