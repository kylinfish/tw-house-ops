# Scan Mode — Portal Scanner

<!-- Read modes/_shared.md before executing this mode. -->

**Execution recommendation:** Run this mode as a background subagent (`Agent` tool with `run_in_background: true`) to protect the main conversation context. Scanning multiple portals can take significant time.

---

## Overview

Three-level scanning strategy:
- **Level 1 — Playwright direct** (primary): Navigate each tracked portal's search results
- **Level 2 — 實價登錄 API** (reference only): Used during evaluation, NOT here — never populates pipeline.md
- **Level 3 — WebSearch** (broad discovery): site: queries to find listings outside tracked portals

---

## Step 1: Read Configuration

1. Read `config/profile.yml`:
   - `regions[].city` and `regions[].districts` → target areas
   - `budget.rent_max` → rental ceiling
   - `budget.buy_max` → purchase ceiling
   - `property.size_min` → minimum size
   - `search.mode` → `rent` | `buy` | `both`

2. Read `portals.yml`:
   - `tracked_portals[]` where `enabled: true`
   - `title_filter.property_types.include` and `.exclude`
   - `title_filter.price.rent_max`, `.buy_max`, `.size_min`
   - `search_queries[]` for Level 3

3. Filter portals by `search.mode`:
   - `rent` → only portals with `type: rent`
   - `buy` → only portals with `type: buy`
   - `both` → all enabled portals

---

## Step 2: Level 1 — Playwright Direct Scan (Primary)

For each enabled portal matching the search mode:

### If portal has `url_template`:

Substitute values from profile into the URL template:
- `{region_code}` → numeric code for `regions[0].city` (台北市 = 1, 新北市 = 2, 桃園市 = 3)
- `{section_codes}` → comma-separated codes for `districts` (look up 591's section codes)
- `{rent_max}` → `budget.rent_max`
- `{buy_max}` → `budget.buy_max`
- `{size_min}` → `property.size_min`

Then: `browser_navigate` to the constructed URL → `browser_snapshot`

### If portal has `base_url`:

`browser_navigate` to `base_url` → `browser_snapshot` → interact with the site's search filters to apply district/price/size criteria → snapshot again.

### Extraction (both methods):

From the search results page, extract each listing:
- `title`: listing title text
- `url`: full listing URL (absolute)
- `address`: street address or district + road
- `price`: price string (e.g., "22,000/月" or "1,280萬")
- `size`: size in 坪
- `layout`: bedroom/bathroom layout (e.g., "2房1衛")
- `portal`: the portal name from portals.yml

### Pagination:

If results show a "next page" / "下一頁" control, navigate to it and continue extracting until:
- No more pages, or
- All results are below the size_min threshold (stop early)

---

## Step 3: Level 3 — WebSearch Discovery (Secondary)

For each `search_queries[]` entry in portals.yml (where `enabled: true`):

1. Substitute template values into `query`:
   - `{districts}` → join profile districts with space (e.g., "信義區 大安區")
   - `{rent_max}` → `budget.rent_max`
   - `{buy_max}` → `budget.buy_max`

2. Run WebSearch with the substituted query

3. For each result URL: **verify liveness with Playwright** before considering it:
   - `browser_navigate` to the URL
   - `browser_snapshot`
   - Check for expired signals:
     - URL contains `error=true` parameter
     - Page content contains "物件已下架" / "no longer available" / "此物件已結束"
     - Content is < 300 characters (only nav/footer, no listing body)
   - Only proceed if listing appears active

---

## Step 4: Phase 1 Quick Filter

Apply to every extracted listing (both Level 1 and Level 3). Check against `portals.yml title_filter` (these are loose scanner ceilings, not the precise profile values):

| Check | Rule | Result |
|-------|------|--------|
| Property type | Title contains an `exclude` type (預售屋, 店面, etc.) | `skipped_title` |
| Price | Price > `title_filter.price.rent_max` (rent) or `.buy_max` (buy) | `skipped_title` |
| Size | Size < `title_filter.size_min` | `skipped_title` |
| Passes all | — | `qualified` |

---

## Step 5: Deduplication

For each `qualified` listing, check against `data/scan-history.tsv`:

**Layer 1 — URL exact match:**
- If the listing URL already exists in the `url` column with status `added` → `skipped_dup`

**Layer 2 — Normalized address match:**
- Normalize the listing's address using the 5 rules from `modes/_shared.md`
- If the normalized address matches any `normalized_address` column value → `skipped_dup`

If neither match → listing is new, proceed to Step 6.

---

## Step 6: Add to Pipeline

For each new qualified listing:

**Append to `data/pipeline.md`:**
```
- [ ] {url} | {portal} | {district} | {type} | {price} | {size} | {layout}
```
Where `{type}` = `租` (rent) or `買` (buy), `{district}` = the listing's district.

**Append to `data/scan-history.tsv`** (9 tab-separated columns):
```
{url}\t{first_seen}\t{portal}\t{title}\t{address}\t{normalized_address}\t{price}\t{size}\tAdded
```
- `first_seen`: today's date (YYYY-MM-DD)
- `normalized_address`: apply the 5 normalization rules from _shared.md

---

## Step 7: Update scan-history.tsv for Skipped Entries

For `skipped_title` and `skipped_dup` listings, also append to `data/scan-history.tsv` with the appropriate status so future scans don't re-process them:
- Title filter fail → status: `skipped_title`
- Duplicate → status: `skipped_dup`
- Expired listing detected → status: `skipped_expired`
- Added to pipeline → status: `added`

---

## Step 8: Scan Summary Output

After completing all portals and updates, output exactly this format:

```
Portal Scan — YYYY-MM-DD
━━━━━━━━━━━━━━━━━━━━━━━━
平台掃描: N
物件找到: N total
快篩通過: N qualified
重複略過: N skipped_dup
標題不符: N skipped_title
已失效略過: N skipped_expired
新增至 pipeline.md: N

  + {district} | {portal} | {price} | {size} | {layout}
  + {district} | {portal} | {price} | {size} | {layout}
  ...

→ 執行 pipeline 模式開始評估新物件。
```

List each newly added listing with a `+` prefix. If nothing was added, say "→ 本次掃描無新物件。"

---

## Notes

- **Level 2 (實價登錄) is evaluation-only.** It provides price comparison data during rent.md / buy.md evaluation — it never populates pipeline.md.
- **Do not verify liveness for Level 1 results** — freshly scraped search pages are assumed live. Liveness verification is only needed for Level 3 (WebSearch cached results).
- **If a portal's page fails to load** (JS error, CAPTCHA, etc.): skip that portal, note it in the summary, continue with others.
