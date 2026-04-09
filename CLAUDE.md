# tw-house-ops — AI House Hunting Pipeline for Taiwan

## What is tw-house-ops

tw-house-ops is an AI-powered real estate search pipeline built on Claude Code, designed for house hunters in Taiwan. It automates listing discovery, evaluation, and tracking across the full search lifecycle — from scanning portals like 591, 樂屋網, and 信義房屋, through structured evaluation against your budget and lifestyle criteria, to managing a tracker of every property you've considered. It supports three buyer personas (renter, first-time buyer, upgrader), handles both rental and purchase markets, and produces structured reports so you can make informed decisions without drowning in listings.

---

## First-Session Checks

On every session start, run these checks **silently** (no output to the user unless action is needed):

1. Does `config/profile.yml` exist?
2. Does `portals.yml` exist?
3. Does `data/tracker.md` exist?
4. Does `data/pipeline.md` exist?
5. Does `modes/_profile.md` exist?
6. Is `agent-browser` installed? Run `which agent-browser` silently.

**If `modes/_profile.md` is missing** → silently copy from `modes/_profile.template.md`. This is the user's customization file and will never be overwritten by system updates.

**If any of the five main files are missing** → enter Onboarding mode (see next section). Do NOT run evaluations, scans, or any other mode until the basics are in place.

**If `agent-browser` is not found** → warn the user immediately (this is NOT silent):
> ⚠️ `agent-browser` 未安裝。掃描（scan）與物件上架驗證功能需要它才能運作。請先執行：
> ```bash
> npm install -g agent-browser
> ```
> 安裝完成後重新開啟 Claude Code 即可正常使用。未安裝的情況下執行 scan 或貼上 URL，爬取結果將不可靠，後續評估可能基於過期或錯誤資料。

---

## Onboarding Flow

Guide the user through these 7 steps in order. Do not skip ahead.

### Step 1: Search Mode

Ask:
> "Are you looking to **rent**, **buy**, or **both**?"

- Set `search.mode` to `rent`, `buy`, or `both`
- Set `buyer_type`:
  - Renting → `renter`
  - Buying, no existing property → `first_time`
  - Buying, already own a home → `upgrader`

### Step 2: Region + Budget

Ask:
> "Which cities or districts are you targeting? And what's your budget?
> - For rent: monthly ceiling in TWD
> - For buy: total price ceiling in TWD, and your max monthly mortgage payment"

Fill in:
- `regions[].city` and `regions[].districts`
- `budget.rent_max` (if renting) or `budget.buy_max` + `budget.monthly_payment_max` (if buying)

### Step 3: Commute Origin

Ask:
> "Where do you commute to? (Work address, school, or major landmark — used to filter by commute time.) What's the maximum commute you'd accept in minutes?"

Fill in:
- `user.commute_origin`
- `user.commute_max_minutes`

### Step 4: Upgrader Supplement (only if `buyer_type = upgrader`)

Ask:
> "Since you're upgrading, I need a few details about your current property to help with timing and tax calculations:
> - Estimated current market value (TWD)
> - Outstanding mortgage balance (TWD)
> - Year you purchased it
> - Strategy: sell first, buy first, or simultaneous?"

Fill in `current_property` block:
- `estimated_value`, `loan_remaining`, `purchase_year`, `selling_strategy`

### Step 5: Create Config Files

Using the answers from Steps 1–4, auto-create the following:

- **`config/profile.yml`** — copy from `config/profile.example.yml`, fill in user's answers
- **`data/tracker.md`** — create with header:
  ```markdown
  # 物件追蹤

  | # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |
  |---|------|------|------|------|------|------|------|------|------|------|
  ```
- **`data/scan-history.tsv`** — create empty file (header only):
  ```
  url	first_seen	last_seen	status
  ```
- **`data/pipeline.md`** — create with header:
  ```markdown
  # Pipeline Inbox

  Paste listing URLs here, one per line. Claude will process them in order.

  ## Pending
  ```

### Step 6: Copy Portals Config

Auto-copy `portals.example.yml` → `portals.yml`. Tell the user:
> "I've copied the default portals configuration. You can customize which sites and search parameters to use by editing `portals.yml`, or just ask me."

### Step 7: Ready

Confirm setup is complete and offer an immediate scan:
> "You're all set! Here's what you can do now:
> - Paste a listing URL to evaluate it
> - Say 'scan' to search your target regions for new listings
> - Say 'pipeline' to process any pending URLs
> - Say 'tracker' to see your search summary
>
> Want me to scan for listings in your target regions right now?"

---

## Main Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Entry point — routing brain Claude reads every session |
| `config/profile.yml` | User preferences: budget, regions, commute, property criteria |
| `portals.yml` | Portal URLs, search queries, and scraping config |
| `data/pipeline.md` | Inbox of pending listing URLs to process |
| `data/tracker.md` | Master tracker of all evaluated properties |
| `data/scan-history.tsv` | Dedup log for scanner (url, first_seen, last_seen, status) |
| `reports/` | Individual evaluation reports (one per listing) |
| `modes/` | Mode files: rent.md, buy.md, afford.md, switch.md, compare.md, visit.md, scan.md, pipeline.md, _shared.md, _profile.md |

---

## Mode Routing

| If the user... | Mode |
|----------------|------|
| Pastes a URL | Auto-pipeline: detect rent vs buy → Phase 1 quick filter → Phase 2 full eval |
| Asks to evaluate a rental | `modes/rent.md` |
| Asks to evaluate a purchase | `modes/buy.md` |
| Wants an affordability calculation | `modes/afford.md` |
| Is planning an upgrade (sell + buy) | `modes/switch.md` |
| Wants to compare two or more listings | `modes/compare.md` |
| Is preparing for a property viewing | `modes/visit.md` |
| Wants to scan portals for new listings | `modes/scan.md` |
| Asks about tracker / search status | Show `data/tracker.md` summary |
| Wants to process pending pipeline URLs | `modes/pipeline.md` |

**When `search.mode: both`:** Detect listing type from page content:
- Contains 月租 or 押金 (without total price) → treat as **rent** → use `modes/rent.md`
- Contains 總價 without monthly rent → treat as **buy** → use `modes/buy.md`
- Ambiguous → ask user before proceeding

---

## Auto-Pipeline Logic

When the user pastes a URL, execute this sequence:

### 1. Verify Listing is Active

Use `agent-browser` (via Bash tool):
```bash
agent-browser open {url}
agent-browser snapshot -i
```

Interpretation:
- Only footer/navbar present, no listing content → listing **closed** → report "Listing no longer available" and stop
- Title + description + price + contact/apply section present → listing **active** → continue

**NEVER** rely on WebSearch or WebFetch alone to verify if a listing is active. Always use `agent-browser`. If `agent-browser` is not installed, stop and remind the user to install it before proceeding.

### 2. Detect Rent vs Buy

From page content:
- Monthly rent figure (月租金 / 月付) + deposit (押金) → **rent**
- Total price (總價) without monthly rent → **buy**
- Ambiguous → ask user

### 3. Phase 1 Quick Filter

Check these criteria against `config/profile.yml`. If any fail, mark **skip** and note the reason:

| Criterion | Profile field | Fail condition |
|-----------|---------------|----------------|
| Price | `budget.rent_max` / `budget.buy_max` | Listing price > budget ceiling |
| Size | `property.size_min` | Listed 坪數 < minimum |
| Floor | `property.floor_min` | Floor < minimum (or ground floor if floor_min > 1) |
| Building age | `property.age_max` | Building age > maximum |

### 4. Phase 2: Full Evaluation

If the listing passes Phase 1:
- Rent listing → load and follow `modes/rent.md`
- Buy listing → load and follow `modes/buy.md`

After evaluation:
- Write evaluation report to `reports/` (see Report Conventions)
- Write TSV entry to `batch/tracker-additions/`
- Run `node merge-tracker.mjs`

### 5. Skip Handling

If Phase 1 disqualifies the listing:
- Output a one-line summary: "Skipped: [reason] ([value] vs limit [limit])"
- Do NOT write a full evaluation report
- Optionally write a minimal TSV entry with status `Skip`

---

## Report Conventions

### Naming

```
{###}-{district}-{road-slug}-{YYYY-MM-DD}.md
```

- `{###}`: sequential 3-digit zero-padded integer (max existing report number + 1)
- `{district}`: district name romanized (e.g., `daan`, `xinyi`, `zhongshan`)
- `{road-slug}`: road name romanized via pinyin approximation, hyphenated (e.g., `renai-rd`, `zhongxiao-e-rd`); if ambiguous or unresolvable, use `road-{4-char-hex}` (e.g., `road-3a7f`)
- `{YYYY-MM-DD}`: evaluation date

Examples:
- `001-daan-renai-rd-2025-04-08.md`
- `042-xinyi-road-3a7f-2025-04-08.md`

### Required Report Header

Every report must include these fields at the top:

```markdown
**URL:** {listing url}
**Score:** {X.X}/5
**Type:** rent | buy
**Status:** {canonical status}
**Verification:** confirmed | unconfirmed (batch mode)
```

### Location

All reports go in `reports/`. Output files (PDFs, etc.) go in `output/` (gitignored).

### After Writing Report

1. Write TSV to `batch/tracker-additions/{num}-{slug}.tsv`
2. Run `node merge-tracker.mjs`

---

## Pipeline Integrity Rules

1. **NEVER write new entries directly to `data/tracker.md`.** Always write a TSV file to `batch/tracker-additions/{num}-{slug}.tsv` and run `node merge-tracker.mjs` to merge. This prevents duplicates and maintains consistent formatting.

2. **Direct edits to `data/tracker.md` are allowed** for updating the `status` or `notes` columns of existing entries. Do not add new rows manually.

3. **`verify-pipeline.mjs`** — run to validate:
   - All reports in `reports/` have a matching tracker entry
   - No unmerged TSV files remain in `batch/tracker-additions/`
   - All statuses are canonical (per `templates/states.yml`)

4. **`dedup-tracker.mjs`** — removes duplicate tracker entries by normalized address. Run if duplicates are suspected.

5. **`merge-tracker.mjs`** — reads all TSV files from `batch/tracker-additions/`, appends rows to `data/tracker.md`, then archives processed TSVs to `batch/tracker-additions/processed/`.

### TSV Format

One file per evaluation: `batch/tracker-additions/{num}-{slug}.tsv`

Single line, tab-separated, 11 columns matching tracker.md headers:

```
{num}\t{date}\t{platform}\t{address}\t{type}\t{price}\t{size}\t{score}/5\t{status}\t{report-link}\t{notes}
```

---

## Canonical Statuses

Source of truth: `templates/states.yml`

| Status | When to use |
|--------|-------------|
| `Scanned` | Found by scanner, not yet evaluated |
| `Evaluated` | Report complete, pending decision |
| `Skip` | Low score or doesn't meet criteria |
| `Visit` | Viewing scheduled |
| `Visited` | Viewed, pending decision |
| `Pass` | Rejected after viewing |
| `Offer` | Offer submitted |
| `Negotiating` | Price negotiation in progress |
| `Signed` | Contract signed |
| `Done` | Move-in complete / title transferred |
| `Expired` | Listing taken down |

Rules:
- No markdown bold in status field
- No dates in status field (use the date column)
- No extra text in status field (use the notes column)

---

## Data Contract

### User Layer (NEVER auto-overwritten)

These files contain your personal data. System updates will never touch them:

- `config/profile.yml`
- `modes/_profile.md`
- `data/*` (tracker, pipeline, scan history)
- `reports/*`
- `output/*`

### System Layer (auto-updatable)

These files are part of the system and may be updated:

- `modes/_shared.md` and all mode files except `modes/_profile.md`
- `CLAUDE.md`
- `*.mjs` scripts
- `templates/*`

### The Rule

**When the user asks to customize anything** (regions, budget, deal-breakers, lifestyle priorities, commute limits), ALWAYS write to `config/profile.yml` or `modes/_profile.md`. NEVER edit `modes/_shared.md` for user-specific content. This ensures system updates don't overwrite their customizations.

---

## Ethical Use

**This system is for quality-focused house hunting, not volume browsing.**

- **NEVER submit, sign, or send a contract, offer, or application without the user reviewing and explicitly approving it first.** Fill forms, draft cover letters, prepare offer summaries — but always STOP before any final action. The user makes the final call.

- **Strongly discourage low-fit properties.** If a score is below **3.5/5**, explicitly recommend against pursuing. The user's time (and the landlord's/agent's time) is valuable. Only proceed if the user has a specific reason to override.

- **Quality over quantity.** Five well-matched properties are worth more than fifty random ones. Guide the user toward fewer, better-targeted evaluations.
