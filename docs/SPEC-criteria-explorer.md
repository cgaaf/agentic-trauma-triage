# Criteria Explorer — `/criteria`

## Overview

Read-only data exploration route for browsing all 137 trauma triage criteria stored in the Supabase `criteria` table. Provides rich client-side filtering with URL-persisted filter state and cross-linking to related examples via a sheet overlay.

---

## Data Source

- **Table**: `public.criteria` (137 rows)
- **Load method**: SvelteKit `+page.server.ts` load function via Supabase server client
- **Columns**: `id`, `description`, `category`, `age_min`, `age_max`, `activation_level`, `notes`

---

## Table

| Column             | Display     | Notes                                 |
| ------------------ | ----------- | ------------------------------------- |
| `id`               | ID          | Right-aligned integer                 |
| `description`      | Description | Full text, wraps                      |
| `category`         | Category    | Adult / Pediatric / Geriatric         |
| `age_min`          | Age Min     | Integer                               |
| `age_max`          | Age Max     | Integer or "—" for NULL (open-ended)  |
| `activation_level` | Level       | Color-coded badge (red/orange/yellow) |
| `notes`            | Notes       | Optional, "—" for NULL                |

- Horizontal scroll on mobile via overflow-x container
- No client-side sorting (static order by id)
- Rows are clickable — opens cross-link sheet

---

## Filter Panel

Collapsible panel above the table using shadcn `Collapsible`:

- **Collapsed state**: Shows count badge with number of active filters (e.g., "3 filters")
- **Expanded state**: Shows all filter controls
- **Header**: "Showing X of Y results" text + "Clear all" button (visible when any filter is active)

### Filters

#### Activation Level — Multi-select toggle chips

- Options: Level 1, Level 2, Level 3
- Toggle on/off independently
- When none selected, show all (no filter)

#### Category — Multi-select toggle chips

- Options: Adult, Pediatric, Geriatric
- Same toggle behavior as activation level

#### Age — Number input

- Single number input: "Patient age"
- Strict containment: `age_min <= input <= age_max` (where NULL `age_max` = infinity)
- Empty input = no age filtering

#### Description — Free text search

- Case-insensitive substring match against `description` column
- Debounced input (300ms)

---

## URL State

All filters serialize to query parameters:

```
/criteria?levels=Level+1,Level+2&categories=Adult&age=25&search=fracture
```

| Parameter    | Type            | Example           |
| ------------ | --------------- | ----------------- |
| `levels`     | Comma-separated | `Level+1,Level+2` |
| `categories` | Comma-separated | `Adult,Geriatric` |
| `age`        | Integer         | `25`              |
| `search`     | String          | `fracture`        |

- Filter changes update URL via `goto('?...', { replaceState: true, noScroll: true })`
- Page load reads URL params to restore filter state
- "Clear all" removes all query params

---

## Cross-Link Sheet

Clicking a criteria row opens a right-side sheet overlay showing:

1. **Criterion details** (id, description, level, category, age range, notes)
2. **Linked examples** fetched via API endpoint

### API Endpoint

`GET /api/criteria/[id]/examples`

Returns JSON:

```json
{
  "criterion": { ... },
  "examples": [ ... ]
}
```

- Fetches the criterion by ID + all examples with matching `criteria_id`
- Sheet shows loading state while fetching
- If no linked examples, shows "No linked examples" message
