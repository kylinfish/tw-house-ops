# tw-house-ops — Design Spec
**Date:** 2026-04-08
**Status:** Approved

---

## Overview

`tw-house-ops` is an AI-powered house hunting pipeline for the Taiwan real estate market, built on Claude Code. It automates discovery, evaluation, and tracking of rental and purchase listings across major Taiwan platforms (591, 樂屋, 信義, 永慶, 東森, 住商, 實價登錄).

Design philosophy: borrowed from `career-ops` (modes/, profile.yml, portals.yml, pipeline.md, TSV tracker), but domain-specific to real estate — no career artifacts.

---

## Scope

- **Market:** Taiwan only (zh-TW)
- **Transaction types:** Rent + Buy
- **Excluded:** 預售屋 (pre-sale new construction)
- **Repo:** Independent (`tw-house-ops`), not part of career-ops

---

## Personas & Buyer Types

Three supported buyer types, configured via `config/profile.yml`:

| buyer_type | Description | Extra Modes |
|------------|-------------|-------------|
| `renter` | 租屋族換屋 | rent, compare, visit |
| `first_time` | 首購族 | buy, afford, compare, visit |
| `upgrader` | 換屋族 | buy, switch, compare, visit |

`buyer_type` drives evaluation weight adjustments and unlocks mode-specific logic:
- `first_time` → 青安貸款 trial calculation injected into buy evaluation
- `upgrader` → 房地合一稅 calculation + dual-track (sell old / buy new)

---

## Repository Structure

```
tw-house-ops/
├── CLAUDE.md                        # System instructions + mode routing
├── config/
│   ├── profile.yml                  # User preferences (NEVER auto-overwritten)
│   └── profile.example.yml          # Template
├── portals.yml                      # Platform config (search URLs, filters)
├── modes/
│   ├── _profile.md                  # Injected into every evaluation (user copy)
│   ├── _profile.template.md         # Template — copied to _profile.md on first run
│   ├── _shared.md                   # Shared scoring dimensions, TW market knowledge
│   ├── scan.md                      # Portal scanner
│   ├── rent.md                      # Rental evaluation
│   ├── buy.md                       # Purchase evaluation
│   ├── afford.md                    # Affordability calculator (first_time)
│   ├── switch.md                    # Upgrade planner (upgrader)
│   ├── compare.md                   # Multi-listing comparison
│   ├── visit.md                     # Visit checklist + negotiation strategy
│   └── pipeline.md                  # Batch pipeline processor
├── data/
│   ├── pipeline.md                  # Pending URL inbox
│   ├── tracker.md                   # Listing tracker
│   └── scan-history.tsv             # All scanned URLs with dedup data
├── reports/                         # Per-listing evaluation reports
├── output/                          # Generated PDFs (gitignored)
├── batch/
│   └── tracker-additions/           # TSV files per evaluation (merged by script)
├── templates/
│   └── states.yml                   # Canonical status definitions
├── merge-tracker.mjs                # Merges TSV additions into tracker.md
├── verify-pipeline.mjs              # Validates pipeline integrity
└── dedup-tracker.mjs                # Removes duplicate tracker entries
```

---

## Mode Routing

| User action | Mode triggered |
|-------------|----------------|
| Pastes URL | auto-pipeline: detect rent vs buy from listing, route to `rent` or `buy` |
| Asks to evaluate rental | `rent` |
| Asks to evaluate purchase | `buy` |
| Wants affordability calc | `afford` |
| Planning an upgrade | `switch` |
| Wants to compare listings | `compare` |
| Preparing for a viewing | `visit` |
| Scanning for new listings | `scan` |
| Checking tracker status | `tracker` |
| Processing pipeline inbox | `pipeline` |

**`search.mode: both`:** When profile has `both`, the agent detects listing type from the page (presence of 月租/押金 = rent; 總價/坪數/屋齡 without monthly rent = buy) and routes accordingly.

---

## Scanning Layer

### Three-Level Strategy

**Level 1 — Playwright direct (primary)**
Navigates each platform's search results page with conditions translated from `profile.yml` into URL query parameters.

Example for 591 rent:
```
https://rent.591.com.tw/?region=1&section=7,8&rentprice=0,25000&area=12,
```

Supported platforms:

| Platform | Type | Method | Rent | Buy |
|----------|------|--------|------|-----|
| 591.com.tw | SPA | Playwright | ✅ | ✅ |
| rakuya.com.tw | SPA | Playwright | ✅ | ✅ |
| sinyi.com.tw | SPA | Playwright | ❌ | ✅ |
| yungching.com.tw | SPA | Playwright | ❌ | ✅ |
| ethouse.com.tw | SPA | Playwright | ❌ | ✅ |
| jjhouse.com.tw | SPA | Playwright | ❌ | ✅ |
| lvr.land.moi.gov.tw | Gov API | REST | ❌ | Reference only |

**Level 2 — 實價登錄 API (market reference)**
Not a source of listings. Used during evaluation to fetch nearby transaction prices. Does not populate pipeline.md.

**Level 3 — WebSearch (broad discovery)**
`site:` filters for discovering listings outside tracked platforms. Results verified with Playwright before entering pipeline (stale cache risk).

### portals.yml Schema

```yaml
title_filter:
  property_types:
    include: ["公寓", "華廈", "大樓", "透天", "套房"]
    exclude: ["預售屋", "店面", "辦公室", "車位"]
  price:
    rent_max: 30000       # loose ceiling for scanner (profile has precise value)
    buy_max: 30000000
  size_min: 10

tracked_portals:
  - name: "591 租屋"
    type: rent
    enabled: true
    url_template: "https://rent.591.com.tw/?region={region_code}&section={section_codes}&rentprice=0,{rent_max}&area={size_min},"

  - name: "591 買屋"
    type: buy
    enabled: true
    url_template: "https://sale.591.com.tw/?region={region_code}&price=0,{buy_max}&area={size_min},"

  # For static portals, use base_url — Playwright navigates directly (no parameterization needed)
  - name: "樂屋網 買屋"
    type: buy
    enabled: true
    base_url: "https://www.rakuya.com.tw/sell/search"

  - name: "信義房屋"
    type: buy
    enabled: true
    base_url: "https://www.sinyi.com.tw/buy/list"

  - name: "永慶房屋"
    type: buy
    enabled: true
    base_url: "https://www.yungching.com.tw/buy"

  - name: "東森房屋"
    type: buy
    enabled: true
    base_url: "https://www.ethouse.com.tw/sell"

  - name: "住商不動產"
    type: buy
    enabled: true
    base_url: "https://www.jjhouse.com.tw/sell"

market_reference:
  lvr_api:
    enabled: true
    use_for: price_comparison   # never populates pipeline

search_queries:                 # Level 3 WebSearch
  - name: "591 rent discovery"
    query: "site:rent.591.com.tw {districts} {rent_max}以下"
    enabled: true
  - name: "591 buy discovery"
    query: "site:sale.591.com.tw {districts} {buy_max}以下"
    enabled: true
```

### Cross-Platform Deduplication

Same property often listed on multiple platforms. Two-layer dedup:

- **Layer 1:** Exact URL match against `scan-history.tsv`
- **Layer 2:** Normalized address match against `normalized_address` column

**Address normalization rules:**
1. `臺` → `台` (character normalization)
2. Floor suffixes: `3F` / `三樓` / `3樓` → `3F`
3. `之` subdivisions stripped for comparison: `1之3號` → `1號` (comparison only, original preserved in storage)
4. Full-width to half-width: `３Ｆ` → `3F`
5. Spaces removed

`scan-history.tsv` columns:
```
url	first_seen	portal	title	address	normalized_address	price	size	status
```

Status values: `added` | `skipped_title` | `skipped_dup` | `skipped_expired`

### Pipeline Entry Format

```
- [ ] https://... | 591 | 信義區 | 租 | 22,000/月 | 15坪 | 2房1衛
- [ ] https://... | 信義房屋 | 大安區 | 買 | 1,280萬 | 28坪 | 3房2衛
```

### Scan Summary Output

After every scan run, output:

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

  + 信義區 | 591 | 22,000/月 | 15坪 | 2房1衛
  ...

→ 執行 /tw-house-ops pipeline 開始評估新物件。
```

### Two Entry Points

| Entry | Flow |
|-------|------|
| Auto scan | profile.yml → search URLs → Playwright → pipeline.md → evaluate |
| Manual URL | User pastes URL → direct evaluation |

Both are needed. Scanner has blind spots (LINE groups, private listings, agent-only releases).

---

## Evaluation Layer

### Two-Phase Evaluation

**Phase 1 — Quick filter** (seconds per listing)
Checks: price vs budget, size vs minimum, building age vs maximum, MRT walk time vs maximum.
Output: `qualified` / `skip`
Only `qualified` proceeds to Phase 2.

(Note: `qualified` is used intentionally to avoid collision with the `Pass` tracker state which means "rejected after viewing.")

**Phase 2 — Full evaluation** (rent.md or buy.md)
Complete report with scoring, price analysis, commute calculation, risk flags.

### Scoring Dimensions

| Dimension | Rent weight | Buy weight |
|-----------|-------------|------------|
| 價格合理性 | 30% | 35% |
| 空間與格局 | 20% | 20% |
| 區域生活機能 | 25% | 20% |
| 物件條件 | 15% | 15% |
| 風險/潛力 | 10% | 10% |

`buyer_type` adjustments:
- `first_time`: 價格 sub-dimension adds 青安貸款 monthly payment calc
- `upgrader`: 風險 sub-dimension adds 房地合一稅 estimate

### Report Format

Key factors in tables, reasoning in prose.

```markdown
# 001 | 信義區忠孝東路五段XX號3F

| 欄位 | 內容 |
|------|------|
| 類型 | 租屋 |
| 分數 | 4.2/5 — 推薦看屋 |
| URL | https://rent.591.com.tw/... |
| 月租 | 22,000 | 坪數 | 15坪 | 格局 | 2房1衛 |
| 刊登日 | 2026-04-05 | 平台 | 591 |

## 價格分析
[table: 月租/坪 vs 行情, 實質月支出]
[prose: interpretation and negotiation context]

## 貸款試算（買屋用）
[table: 方案, 利率, 頭期款, 月付, 總利息]
[prose: recommendation based on buyer_type]

## 通勤試算
[table: 交通方式, 時間, 備註]

## 維度評分
[table: all 5 dimensions with scores and key factors]
[prose: overall recommendation rationale]

## 疑點清單
[table: #, 疑點, 風險等級]
[prose: explanation of most significant risks]

## 看屋問題清單
[table: #, 問題, 類別]
```

Report naming: `{###}-{district}-{road-slug}-{YYYY-MM-DD}.md`

**Road slug normalization:** Romanize or use numeric fallback to ensure ASCII-safe filenames. Example: `忠孝東路五段` → `zhongxiao-e-rd-sec5` or `road-{hash4}`. Agent applies consistent romanization via pinyin approximation; if ambiguous, use `road-{4-char-hex-of-address-hash}`.

### Mode-Specific Logic

**`afford.md`** (first_time only)
- Input: monthly income + savings from profile
- Output:
  - Max affordable total price (bank loan ceiling based on income × 20-year rule of thumb)
  - Recommended loan plan table (青安 vs 一般, multiple down payment scenarios)
  - Ranked district table: districts from `regions` sorted by median price-per-坪 vs user budget, showing how many 坪 the budget buys in each district

**`switch.md`** (upgrader only)
- Dual-track: sell old property + buy new
- 房地合一稅 calculation based on `current_property.purchase_year` → holding period → applicable rate
- Bridge financing gap: estimated sale proceeds minus loan remainder vs target down payment
- Strategy recommendation table: sell_first / buy_first / simultaneous with pros/cons per user's financial situation

**`compare.md`**
- Input: 2–N evaluated reports
- Output: side-by-side table across all dimensions + ranked recommendation with prose rationale

**`visit.md`**
- Input: evaluation report number (e.g., `001`)
- Output:
  1. Visit checklist table (universal items + property-specific items derived from report's 疑點清單)
  2. Negotiation strategy: price range table (list price → 實登 median → suggested offer → walkaway)
  3. Post-visit record template (markdown form to fill in)
- After user fills post-visit record: update tracker.md entry status from `Visit` → `Visited`, append visit notes to the notes column

---

## Tracker

### tracker.md Format

```markdown
# 物件追蹤

| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |
|---|------|------|------|------|------|------|------|------|------|------|
| 001 | 2026-04-08 | 591 | 信義區忠孝東路五段XX號3F | 租 | 22,000/月 | 15坪 | 4.2/5 | 待看屋 | [001](reports/001-...) | 無電梯 |
```

### TSV Format for Tracker Additions

Write one TSV file per evaluation to `batch/tracker-additions/{num}-{slug}.tsv`. Single line, 11 tab-separated columns matching tracker.md column order:

```
{num}\t{date}\t{portal}\t{address}\t{type}\t{price}\t{size}\t{score}/5\t{status}\t[{num}](reports/{slug})\t{notes}
```

**Column order:**
1. `num` — sequential number (integer, 3-digit zero-padded)
2. `date` — YYYY-MM-DD
3. `portal` — platform name (e.g., `591`, `信義房屋`)
4. `address` — district + road + floor (e.g., `信義區忠孝東路五段XX號3F`)
5. `type` — `租` or `買`
6. `price` — `22,000/月` (rent) or `1,280萬` (buy)
7. `size` — `15坪`
8. `score` — `X.X/5`
9. `status` — canonical status from states.yml
10. `report` — markdown link `[num](reports/...)`
11. `notes` — one-line summary

### State Machine (`templates/states.yml`)

```
Scanned → Evaluated → Skip
                    ↓
                  Visit → Visited → Pass
                                  ↓
                    Offer → Negotiating → Signed → Done
                                          ↑
                              (rent: Offer → Signed directly)

Any state → Expired (listing taken down)
```

| Status | Description | Applies to |
|--------|-------------|------------|
| `Scanned` | Found by scanner, not yet evaluated | Both |
| `Evaluated` | Report complete, pending decision | Both |
| `Skip` | Low score or doesn't fit needs | Both |
| `Visit` | Viewing scheduled | Both |
| `Visited` | Viewed, pending decision | Both |
| `Pass` | Rejected after viewing | Both |
| `Offer` | Offer submitted | Both |
| `Negotiating` | Price negotiation in progress | Both (rent: rent reduction / extra terms; buy: price negotiation) |
| `Signed` | Contract signed | Both |
| `Done` | Move-in / title transferred | Both |
| `Expired` | Listing taken down | Both |

### Pipeline Integrity Rules

1. **NEVER write new entries directly to tracker.md** — write TSV to `batch/tracker-additions/`, run `merge-tracker.mjs`
2. **Direct edits to tracker.md allowed** for status/notes updates on existing entries
3. **`verify-pipeline.mjs`**: validates that all reports in `reports/` have a corresponding tracker entry, all TSV files in `tracker-additions/` have been merged, and all statuses are canonical
4. **`dedup-tracker.mjs`**: removes duplicate tracker entries by address normalization (same rules as scan dedup)
5. **`merge-tracker.mjs`**: reads all TSV files from `tracker-additions/`, inserts new rows into tracker.md in sequential order, moves processed TSVs to `batch/tracker-additions/processed/`

---

## Profile Structure (`config/profile.yml`)

```yaml
user:
  name: ""
  commute_origin: ""
  commute_max_minutes: 40

search:
  mode: rent                  # rent | buy | both
  buyer_type: first_time      # renter | first_time | upgrader

budget:
  rent_max: 25000
  buy_max: 15000000
  monthly_payment_max: 35000

finance:
  monthly_income: 80000
  savings: 1500000
  youth_loan_eligible: true   # 青安貸款 (age ≤ 40, no existing property)

current_property:             # upgrader only
  estimated_value: null
  loan_remaining: null
  purchase_year: null
  selling_strategy: sell_first  # sell_first | buy_first | simultaneous

property:
  size_min: 12
  size_max: null
  floor_min: 2
  types:
    include: ["公寓", "華廈", "大樓"]
    exclude: ["預售屋", "店面", "車位"]
  age_max: 40
  elevator: optional          # true | false | optional
  parking: optional
  pet: false

regions:
  - city: "台北市"
    districts: ["信義區", "大安區"]

lifestyle:
  mrt_walk_max: 15
  priorities: ["mrt", "supermarket", "school", "hospital"]

narrative:
  deal_breakers: []
  nice_to_have: []
  notes: ""
```

---

## Onboarding Flow

On first session, check for: `config/profile.yml`, `portals.yml`, `data/tracker.md`, `data/pipeline.md`, `modes/_profile.md`.

- If `modes/_profile.md` is missing, **silently copy from `modes/_profile.template.md`**. This file is in the user layer and will never be overwritten by system updates.

If any of the five main files are missing, enter onboarding:

1. **Search mode** — rent / buy / both → sets `search.mode` + `buyer_type`
2. **Region + budget** → fills `regions` + `budget`
3. **Commute origin** → fills `commute_origin` + `commute_max_minutes`
4. **Upgrader supplement** (if `buyer_type = upgrader`) → fills `current_property`
5. **Auto-create** `config/profile.yml` from `config/profile.example.yml` (with answers from steps 1–4) + `data/tracker.md` + `data/scan-history.tsv` + `data/pipeline.md`
6. **Auto-copy** `portals.example.yml` → `portals.yml` (system layer default, user can customize later)
7. **Ready** → offer immediate scan of target regions

---

## Data Contract

**User Layer (NEVER auto-overwritten):**
`config/profile.yml`, `modes/_profile.md`, `data/*`, `reports/*`, `output/*`

**System Layer (auto-updatable):**
`modes/_shared.md`, all mode files except `_profile.md`, `CLAUDE.md`, `*.mjs` scripts, `templates/*`

**Rule:** All user customizations go to `config/profile.yml` or `modes/_profile.md`. Never edit `modes/_shared.md` for user-specific content.

---

## Out of Scope (v1)

- Batch headless processing (batch/ TSV mechanism kept for merge compatibility, no worker scripts)
- Multi-market support (non-Taiwan platforms)
- Canva visual report generation
- Push notifications / scheduled auto-scan (can be added via `/schedule` skill later)
