# tw-house-ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code-powered house hunting pipeline for Taiwan covering rental and purchase listings across 591, 樂屋, 信義, 永慶, 東森, 住商, and 實價登錄.

**Architecture:** Mode-file system where each Claude mode (scan, rent, buy, afford, switch, compare, visit, pipeline) is a Markdown instruction file read at runtime. Static config in YAML (portals.yml, profile.yml, states.yml). Three Node.js scripts handle tracker maintenance (merge, verify, dedup). CLAUDE.md is the entry point that routes user intent to the right mode.

**Tech Stack:** Claude Code, Node.js ESM (.mjs), YAML, Markdown, Playwright (browser automation used by Claude at runtime — no npm install needed for modes), node:test (built-in test runner for scripts)

---

## File Map

| File | Responsibility |
|------|----------------|
| `CLAUDE.md` | Entry point: mode routing, onboarding flow, data contract, update-check stub |
| `config/profile.example.yml` | Template users copy to `config/profile.yml` |
| `portals.example.yml` | Platform config template (copied to `portals.yml` during onboarding) |
| `templates/states.yml` | Canonical tracker status definitions |
| `modes/_profile.template.md` | User profile narrative template (copied to `_profile.md` silently) |
| `modes/_shared.md` | Shared: scoring weights, TW market knowledge, terminology, address normalization rules |
| `modes/scan.md` | 3-level scanner: Playwright → 實價登錄 API → WebSearch, dedup, pipeline entry |
| `modes/rent.md` | Phase 1 quick filter + Phase 2 full rental evaluation + report generation |
| `modes/buy.md` | Phase 1 quick filter + Phase 2 full purchase evaluation + report generation |
| `modes/afford.md` | Affordability calculator for first_time buyers |
| `modes/switch.md` | Dual-track upgrade planner for upgraders |
| `modes/compare.md` | Multi-listing side-by-side comparison |
| `modes/visit.md` | Visit checklist, negotiation strategy, post-visit record |
| `modes/pipeline.md` | Batch processor: iterate pending pipeline.md entries |
| `merge-tracker.mjs` | Reads TSV from batch/tracker-additions/, appends to tracker.md, archives to processed/ |
| `verify-pipeline.mjs` | Validates pipeline integrity: reports↔tracker, unmerged TSVs, canonical statuses |
| `dedup-tracker.mjs` | Removes duplicate tracker rows by normalized address |
| `tests/merge-tracker.test.mjs` | Tests for merge-tracker.mjs |
| `tests/verify-pipeline.test.mjs` | Tests for verify-pipeline.mjs |
| `tests/dedup-tracker.test.mjs` | Tests for dedup-tracker.mjs |
| `tests/normalize-address.test.mjs` | Tests for address normalization logic (shared utility) |
| `lib/normalize-address.mjs` | Shared address normalization (used by merge, verify, dedup) |
| `data/pipeline.md` | Empty pending URL inbox (created during onboarding or pre-created) |
| `data/tracker.md` | Empty tracker table header |
| `.gitignore` | Ignores output/, batch/tracker-additions/processed/, data/scan-history.tsv stub |

---

## Task 1: Repo Initialization

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `data/pipeline.md`
- Create: `data/tracker.md`
- Create: `reports/.gitkeep`
- Create: `output/.gitkeep`
- Create: `batch/tracker-additions/.gitkeep`
- Create: `batch/tracker-additions/processed/.gitkeep`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/win.yu/Github/tw-house-ops
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "tw-house-ops",
  "version": "0.1.0",
  "type": "module",
  "description": "AI-powered house hunting pipeline for Taiwan",
  "scripts": {
    "test": "node --test tests/**/*.test.mjs",
    "merge": "node merge-tracker.mjs",
    "verify": "node verify-pipeline.mjs",
    "dedup": "node dedup-tracker.mjs"
  }
}
```

- [ ] **Step 3: Create .gitignore**

```
output/
batch/tracker-additions/processed/
node_modules/
.DS_Store
```

- [ ] **Step 4: Create empty data files**

`data/pipeline.md`:
```markdown
# Pipeline — Pending Listings

<!-- Add URLs here for evaluation. Format: -->
<!-- - [ ] https://... | Platform | District | Type | Price | Size | Layout -->
```

`data/tracker.md`:
```markdown
# 物件追蹤

| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |
|---|------|------|------|------|------|------|------|------|------|------|
```

`data/scan-history.tsv`:
```
url	first_seen	portal	title	address	normalized_address	price	size	status
```

- [ ] **Step 5: Create directory placeholders**

```bash
touch reports/.gitkeep output/.gitkeep batch/tracker-additions/.gitkeep batch/tracker-additions/processed/.gitkeep
```

- [ ] **Step 6: Initial commit**

```bash
git add .
git commit -m "chore: initialize tw-house-ops repo structure"
```

---

## Task 2: Static Config Files

**Files:**
- Create: `templates/states.yml`
- Create: `config/profile.example.yml`
- Create: `portals.example.yml`

- [ ] **Step 1: Create templates/states.yml**

```yaml
# Canonical tracker statuses for tw-house-ops
# Source of truth for all status fields in tracker.md
states:
  - name: Scanned
    description: Found by scanner, not yet evaluated
    applies_to: [rent, buy]

  - name: Evaluated
    description: Report complete, pending decision
    applies_to: [rent, buy]

  - name: Skip
    description: Low score or doesn't fit needs
    applies_to: [rent, buy]

  - name: Visit
    description: Viewing scheduled
    applies_to: [rent, buy]

  - name: Visited
    description: Viewed, pending decision
    applies_to: [rent, buy]

  - name: Pass
    description: Rejected after viewing
    applies_to: [rent, buy]

  - name: Offer
    description: Offer submitted
    applies_to: [rent, buy]

  - name: Negotiating
    description: Price negotiation in progress (rent: rent reduction / extra terms; buy: price)
    applies_to: [rent, buy]

  - name: Signed
    description: Contract signed
    applies_to: [rent, buy]

  - name: Done
    description: Move-in complete / title transferred
    applies_to: [rent, buy]

  - name: Expired
    description: Listing taken down
    applies_to: [rent, buy]

transitions:
  - from: Scanned
    to: [Evaluated, Expired]
  - from: Evaluated
    to: [Visit, Skip, Expired]
  - from: Skip
    to: [Expired]
  - from: Visit
    to: [Visited, Expired]
  - from: Visited
    to: [Offer, Pass, Expired]
  - from: Pass
    to: [Expired]
  - from: Offer
    to: [Negotiating, Signed, Expired]
  - from: Negotiating
    to: [Signed, Pass, Expired]
  - from: Signed
    to: [Done]
  - from: Done
    to: []
  - from: Expired
    to: []
```

- [ ] **Step 2: Create config/profile.example.yml**

```yaml
# tw-house-ops User Profile
# Copy this file to config/profile.yml and fill in your details.
# This file (profile.yml) is in the USER LAYER — it will never be overwritten by system updates.

user:
  name: ""                          # Your name
  commute_origin: ""                # Work/school address for commute calculation
  commute_max_minutes: 40           # Max acceptable commute (minutes)

search:
  mode: rent                        # rent | buy | both
  buyer_type: renter                # renter | first_time | upgrader

budget:
  rent_max: 25000                   # Monthly rent ceiling (TWD)
  buy_max: 15000000                 # Total purchase price ceiling (TWD)
  monthly_payment_max: 35000        # Max monthly mortgage payment (TWD)

finance:                            # Used for buy mode
  monthly_income: 80000             # Gross monthly income (TWD)
  savings: 1500000                  # Available for down payment (TWD)
  youth_loan_eligible: true         # 青安貸款: age ≤ 40, no existing property

current_property:                   # upgrader only — leave null if not applicable
  estimated_value: null             # Estimated current market value (TWD)
  loan_remaining: null              # Outstanding mortgage balance (TWD)
  purchase_year: null               # Year purchased (for 房地合一稅 calculation)
  selling_strategy: sell_first      # sell_first | buy_first | simultaneous

property:
  size_min: 12                      # Minimum size (坪)
  size_max: null                    # Maximum size (坪), null = no limit
  floor_min: 2                      # Minimum floor (1 = ground floor ok)
  types:
    include: ["公寓", "華廈", "大樓", "透天", "套房"]
    exclude: ["預售屋", "店面", "辦公室", "車位"]
  age_max: 40                       # Maximum building age (years)
  elevator: optional                # true | false | optional
  parking: optional                 # true | false | optional
  pet: false                        # Pet-friendly required?

regions:
  - city: "台北市"
    districts: ["信義區", "大安區"]  # Target districts
  # - city: "新北市"
  #   districts: ["板橋區"]

lifestyle:
  mrt_walk_max: 15                  # Max walking distance to MRT (minutes)
  priorities:                       # Ranked by importance
    - mrt
    - supermarket
    - school
    - hospital

narrative:
  deal_breakers:                    # Automatic disqualifiers
    - "頂樓加蓋"
    - "一樓"
    - "鄰近殯儀館"
  nice_to_have:                     # Positive signals (boost score)
    - "南北採光"
    - "社區管理"
  notes: ""                         # Free text: anything else the evaluator should know
```

- [ ] **Step 3: Create portals.example.yml**

```yaml
# tw-house-ops Portal Configuration
# Copy this file to portals.yml. It will be auto-copied during onboarding.
# portals.yml is in the SYSTEM LAYER — it may be updated by system updates.
# Add custom companies to tracked_portals and adjust title_filter for your needs.

title_filter:
  property_types:
    include: ["公寓", "華廈", "大樓", "透天", "套房"]
    exclude: ["預售屋", "店面", "辦公室", "車位", "工業用"]
  price:
    rent_max: 30000       # Loose scanner ceiling — profile.yml has the precise value
    buy_max: 30000000
  size_min: 10            # Loose scanner floor

tracked_portals:
  # 591 uses url_template — parameters are substituted from profile.yml at scan time
  - name: "591 租屋"
    type: rent
    enabled: true
    url_template: "https://rent.591.com.tw/?region={region_code}&section={section_codes}&rentprice=0,{rent_max}&area={size_min},"

  - name: "591 買屋"
    type: buy
    enabled: true
    url_template: "https://sale.591.com.tw/?region={region_code}&price=0,{buy_max}&area={size_min},"

  # Static portals use base_url — Playwright navigates directly, then applies filters via UI
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
    use_for: price_comparison   # Never populates pipeline — only injected into evaluation reports

search_queries:                 # Level 3: WebSearch broad discovery
  - name: "591 rent discovery"
    query: "site:rent.591.com.tw {districts} {rent_max}以下"
    enabled: true
  - name: "591 buy discovery"
    query: "site:sale.591.com.tw {districts} {buy_max}以下"
    enabled: true
  - name: "Rakuya buy discovery"
    query: "site:rakuya.com.tw {districts} 買屋"
    enabled: true
```

- [ ] **Step 4: Commit**

```bash
git add templates/ config/ portals.example.yml
git commit -m "feat: add static config templates (states, profile, portals)"
```

---

## Task 3: Address Normalization Library

This shared utility is extracted first because it's referenced by merge-tracker, verify-pipeline, dedup-tracker, and scan mode.

**Files:**
- Create: `lib/normalize-address.mjs`
- Create: `tests/normalize-address.test.mjs`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/normalize-address.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAddress } from '../lib/normalize-address.mjs'

test('converts 臺 to 台', () => {
  assert.equal(normalizeAddress('臺北市信義區'), '台北市信義區')
})

test('normalizes floor suffix 三樓 to 3F', () => {
  assert.equal(normalizeAddress('台北市信義區忠孝東路五段1號三樓'), '台北市信義區忠孝東路五段1號3F')
})

test('normalizes floor suffix 3樓 to 3F', () => {
  assert.equal(normalizeAddress('台北市信義區忠孝東路五段1號3樓'), '台北市信義區忠孝東路五段1號3F')
})

test('keeps 3F as-is', () => {
  assert.equal(normalizeAddress('台北市信義區忠孝東路五段1號3F'), '台北市信義區忠孝東路五段1號3F')
})

test('strips 之 subdivisions for comparison', () => {
  assert.equal(normalizeAddress('台北市大安區和平東路一段1之3號'), '台北市大安區和平東路一段1號')
})

test('converts full-width digits and letters to half-width', () => {
  assert.equal(normalizeAddress('台北市信義區忠孝東路５段１號３Ｆ'), '台北市信義區忠孝東路5段1號3F')
})

test('removes spaces', () => {
  assert.equal(normalizeAddress('台北市 信義區 忠孝東路'), '台北市信義區忠孝東路')
})

test('handles combined transformations', () => {
  const input = '臺北市大安區和平東路一段１之３號 ３Ｆ'
  const expected = '台北市大安區和平東路一段1號3F'
  assert.equal(normalizeAddress(input), expected)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/normalize-address.test.mjs
```

Expected: failures on all tests (module not found or assertions fail)

- [ ] **Step 3: Implement normalize-address.mjs**

```javascript
// lib/normalize-address.mjs

/**
 * Normalize a Taiwan address for cross-platform deduplication.
 * Rules:
 *  1. 臺 → 台
 *  2. Floor suffixes: N樓 / 三樓 etc. → NF
 *  3. Strip 之 subdivisions: 1之3號 → 1號
 *  4. Full-width → half-width (digits and ASCII letters)
 *  5. Remove spaces
 */
export function normalizeAddress(address) {
  let s = address

  // Rule 1: 臺 → 台
  s = s.replace(/臺/g, '台')

  // Rule 4: Full-width digits (０-９) and letters (Ａ-Ｚ, ａ-ｚ) → half-width
  s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  s = s.replace(/[Ａ-Ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  s = s.replace(/[ａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))

  // Rule 3: Strip 之 subdivisions — "1之3號" → "1號", "2之1" → "2"
  s = s.replace(/(\d+)之\d+/g, '$1')

  // Rule 2: Floor normalization
  // Chinese ordinal floors: 一樓..十樓 → 1F..10F
  const chineseNums = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 }
  s = s.replace(/([一二三四五六七八九十]+)樓/g, (_, cn) => {
    // handle simple single-char Chinese numbers
    const num = chineseNums[cn]
    return num ? `${num}F` : `${cn}F`
  })
  // Numeric floors: 3樓 → 3F
  s = s.replace(/(\d+)樓/g, '$1F')

  // Rule 5: Remove spaces
  s = s.replace(/\s+/g, '')

  return s
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
node --test tests/normalize-address.test.mjs
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/normalize-address.mjs tests/normalize-address.test.mjs
git commit -m "feat: add address normalization library with tests"
```

---

## Task 4: merge-tracker.mjs

Reads TSV files from `batch/tracker-additions/`, appends rows to `data/tracker.md`, moves processed files to `batch/tracker-additions/processed/`.

**Files:**
- Create: `merge-tracker.mjs`
- Create: `tests/merge-tracker.test.mjs`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/merge-tracker.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mergeTSV } from '../merge-tracker.mjs'

const FIXTURES = path.join(import.meta.dirname, 'fixtures/merge-tracker')

before(() => {
  fs.mkdirSync(FIXTURES, { recursive: true })
  fs.mkdirSync(path.join(FIXTURES, 'batch/tracker-additions/processed'), { recursive: true })
})

after(() => {
  fs.rmSync(FIXTURES, { recursive: true, force: true })
})

test('appends TSV row to tracker.md', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker.md')
  const additionsDir = path.join(FIXTURES, 'batch/tracker-additions')

  // Write empty tracker
  fs.writeFileSync(trackerPath,
    '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'
  )

  // Write a TSV addition
  const tsv = '001\t2026-04-08\t591\t信義區忠孝東路五段1號3F\t租\t22,000/月\t15坪\t4.2/5\tEvaluated\t[001](reports/001-...)\t無電梯\n'
  fs.writeFileSync(path.join(additionsDir, '001-xinyi.tsv'), tsv)

  await mergeTSV({ trackerPath, additionsDir, processedDir: path.join(additionsDir, 'processed') })

  const content = fs.readFileSync(trackerPath, 'utf8')
  assert.ok(content.includes('| 001 |'), 'tracker should contain new row')
  assert.ok(content.includes('信義區忠孝東路五段1號3F'), 'tracker should contain address')
})

test('moves processed TSV to processed/ directory', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker2.md')
  const additionsDir = path.join(FIXTURES, 'batch/tracker-additions')
  const processedDir = path.join(additionsDir, 'processed')

  fs.writeFileSync(trackerPath,
    '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'
  )

  const tsv = '002\t2026-04-08\t591\t大安區和平東路一段1號5F\t買\t1,280萬\t28坪\t3.8/5\tEvaluated\t[002](reports/002-...)\t-\n'
  const tsvPath = path.join(additionsDir, '002-daan.tsv')
  fs.writeFileSync(tsvPath, tsv)

  await mergeTSV({ trackerPath, additionsDir, processedDir })

  assert.ok(!fs.existsSync(tsvPath), 'original TSV should be removed')
  assert.ok(fs.existsSync(path.join(processedDir, '002-daan.tsv')), 'TSV should be in processed/')
})

test('skips .gitkeep files in additions dir', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker3.md')
  const additionsDir = path.join(FIXTURES, 'batch/tracker-additions')

  fs.writeFileSync(trackerPath,
    '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'
  )
  fs.writeFileSync(path.join(additionsDir, '.gitkeep'), '')

  // Should not throw
  await mergeTSV({ trackerPath, additionsDir, processedDir: path.join(additionsDir, 'processed') })

  const content = fs.readFileSync(trackerPath, 'utf8')
  // Only header, no new rows
  const rows = content.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))
  assert.equal(rows.length, 0)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/merge-tracker.test.mjs
```

Expected: FAIL (merge-tracker.mjs not found)

- [ ] **Step 3: Implement merge-tracker.mjs**

```javascript
// merge-tracker.mjs
import fs from 'node:fs'
import path from 'node:path'

export async function mergeTSV({
  trackerPath = 'data/tracker.md',
  additionsDir = 'batch/tracker-additions',
  processedDir = 'batch/tracker-additions/processed'
} = {}) {
  fs.mkdirSync(processedDir, { recursive: true })

  const files = fs.readdirSync(additionsDir)
    .filter(f => f.endsWith('.tsv'))
    .sort()

  if (files.length === 0) {
    console.log('No TSV files to merge.')
    return
  }

  let tracker = fs.readFileSync(trackerPath, 'utf8')
  let merged = 0

  for (const file of files) {
    const filePath = path.join(additionsDir, file)
    const content = fs.readFileSync(filePath, 'utf8').trim()
    if (!content) continue

    const cols = content.split('\t')
    if (cols.length !== 11) {
      console.warn(`Skipping ${file}: expected 11 columns, got ${cols.length}`)
      continue
    }

    const [num, date, portal, address, type, price, size, score, status, report, notes] = cols
    const row = `| ${num} | ${date} | ${portal} | ${address} | ${type} | ${price} | ${size} | ${score} | ${status} | ${report} | ${notes} |`

    tracker = tracker.trimEnd() + '\n' + row + '\n'

    fs.renameSync(filePath, path.join(processedDir, file))
    merged++
  }

  fs.writeFileSync(trackerPath, tracker)
  console.log(`Merged ${merged} TSV file(s) into ${trackerPath}`)
}

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  mergeTSV().catch(err => { console.error(err); process.exit(1) })
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
node --test tests/merge-tracker.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add merge-tracker.mjs tests/merge-tracker.test.mjs
git commit -m "feat: add merge-tracker script with tests"
```

---

## Task 5: verify-pipeline.mjs

Validates: all `reports/*.md` files have a tracker entry, no unmerged TSVs in `tracker-additions/`, all statuses are canonical.

**Files:**
- Create: `verify-pipeline.mjs`
- Create: `tests/verify-pipeline.test.mjs`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/verify-pipeline.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { verifyPipeline } from '../verify-pipeline.mjs'

const FIXTURES = path.join(import.meta.dirname, 'fixtures/verify-pipeline')

before(() => {
  fs.mkdirSync(path.join(FIXTURES, 'reports'), { recursive: true })
  fs.mkdirSync(path.join(FIXTURES, 'batch/tracker-additions'), { recursive: true })
  fs.mkdirSync(path.join(FIXTURES, 'templates'), { recursive: true })
})

after(() => {
  fs.rmSync(FIXTURES, { recursive: true, force: true })
})

function makeTracker(rows) {
  const header = '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'
  return header + rows.join('\n') + '\n'
}

test('returns no issues when everything is clean', async () => {
  const dir = path.join(FIXTURES, 'clean')
  fs.mkdirSync(path.join(dir, 'reports'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'batch/tracker-additions'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'templates'), { recursive: true })

  fs.writeFileSync(path.join(dir, 'data/tracker.md'),
    makeTracker(['| 001 | 2026-04-08 | 591 | 信義區 | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](reports/001-xinyi.md) | - |']),
    { flag: 'w' }
  )
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'data/tracker.md'),
    makeTracker(['| 001 | 2026-04-08 | 591 | 信義區 | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](reports/001-xinyi.md) | - |'])
  )
  fs.writeFileSync(path.join(dir, 'reports/001-xinyi.md'), '# 001')
  fs.writeFileSync(path.join(dir, 'templates/states.yml'), 'states:\n  - name: Evaluated\n  - name: Skip\n  - name: Visit\n  - name: Visited\n  - name: Pass\n  - name: Offer\n  - name: Negotiating\n  - name: Signed\n  - name: Done\n  - name: Expired\n  - name: Scanned\n')
  fs.writeFileSync(path.join(dir, 'batch/tracker-additions/.gitkeep'), '')

  const issues = await verifyPipeline({ rootDir: dir })
  assert.deepEqual(issues, [])
})

test('reports orphaned report files (no tracker entry)', async () => {
  const dir = path.join(FIXTURES, 'orphan')
  fs.mkdirSync(path.join(dir, 'reports'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'batch/tracker-additions'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'templates'), { recursive: true })

  fs.writeFileSync(path.join(dir, 'data/tracker.md'), makeTracker([]))
  fs.writeFileSync(path.join(dir, 'reports/001-xinyi.md'), '# 001')
  fs.writeFileSync(path.join(dir, 'templates/states.yml'), 'states: []')

  const issues = await verifyPipeline({ rootDir: dir })
  assert.ok(issues.some(i => i.includes('001-xinyi.md')))
})

test('reports unmerged TSV files', async () => {
  const dir = path.join(FIXTURES, 'unmerged')
  fs.mkdirSync(path.join(dir, 'reports'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'batch/tracker-additions'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'templates'), { recursive: true })

  fs.writeFileSync(path.join(dir, 'data/tracker.md'), makeTracker([]))
  fs.writeFileSync(path.join(dir, 'batch/tracker-additions/001-xinyi.tsv'), '001\tdata...')
  fs.writeFileSync(path.join(dir, 'templates/states.yml'), 'states: []')

  const issues = await verifyPipeline({ rootDir: dir })
  assert.ok(issues.some(i => i.includes('unmerged')))
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
node --test tests/verify-pipeline.test.mjs
```

- [ ] **Step 3: Implement verify-pipeline.mjs**

```javascript
// verify-pipeline.mjs
import fs from 'node:fs'
import path from 'node:path'

export async function verifyPipeline({ rootDir = '.' } = {}) {
  const issues = []

  // Load canonical states
  const statesPath = path.join(rootDir, 'templates/states.yml')
  const statesRaw = fs.existsSync(statesPath) ? fs.readFileSync(statesPath, 'utf8') : ''
  const canonicalStatuses = new Set(
    (statesRaw.match(/- name: (\S+)/g) || []).map(m => m.replace('- name: ', ''))
  )

  // Check tracker.md exists
  const trackerPath = path.join(rootDir, 'data/tracker.md')
  if (!fs.existsSync(trackerPath)) {
    issues.push('MISSING: data/tracker.md not found')
    return issues
  }

  // Parse tracker rows
  const trackerContent = fs.readFileSync(trackerPath, 'utf8')
  const trackerRows = trackerContent.split('\n')
    .filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))
  
  const trackerReportRefs = new Set()
  for (const row of trackerRows) {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 10) continue
    const status = cols[8]
    const reportCol = cols[9]

    // Check canonical status
    if (canonicalStatuses.size > 0 && !canonicalStatuses.has(status)) {
      issues.push(`INVALID STATUS: "${status}" in tracker row: ${row.slice(0, 60)}`)
    }

    // Extract report filename from markdown link [001](reports/...)
    const match = reportCol.match(/\(reports\/([^)]+)\)/)
    if (match) trackerReportRefs.add(match[1])
  }

  // Check report files have tracker entries
  const reportsDir = path.join(rootDir, 'reports')
  if (fs.existsSync(reportsDir)) {
    const reportFiles = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md'))
    for (const file of reportFiles) {
      if (!trackerReportRefs.has(file)) {
        issues.push(`ORPHANED REPORT: reports/${file} has no tracker entry`)
      }
    }
  }

  // Check for unmerged TSVs
  const additionsDir = path.join(rootDir, 'batch/tracker-additions')
  if (fs.existsSync(additionsDir)) {
    const unmerged = fs.readdirSync(additionsDir).filter(f => f.endsWith('.tsv'))
    if (unmerged.length > 0) {
      issues.push(`UNMERGED TSVs: ${unmerged.length} file(s) pending merge: ${unmerged.join(', ')}`)
    }
  }

  return issues
}

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  verifyPipeline().then(issues => {
    if (issues.length === 0) {
      console.log('✓ Pipeline integrity OK')
    } else {
      console.error('Pipeline issues found:')
      issues.forEach(i => console.error(' •', i))
      process.exit(1)
    }
  }).catch(err => { console.error(err); process.exit(1) })
}
```

Note: `verify-pipeline.mjs` uses a minimal YAML state parser via regex rather than a full YAML library to avoid external dependencies. Create `lib/yaml.mjs` as a stub (not needed for the regex approach — the `parseYAML` import above is unused; remove it from the final implementation and parse states via regex directly as shown).

- [ ] **Step 4: Run tests — expect pass**

```bash
node --test tests/verify-pipeline.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add verify-pipeline.mjs tests/verify-pipeline.test.mjs
git commit -m "feat: add verify-pipeline script with tests"
```

---

## Task 6: dedup-tracker.mjs

Removes duplicate tracker rows using normalized address matching.

**Files:**
- Create: `dedup-tracker.mjs`
- Create: `tests/dedup-tracker.test.mjs`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/dedup-tracker.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { dedupTracker } from '../dedup-tracker.mjs'

const FIXTURES = path.join(import.meta.dirname, 'fixtures/dedup-tracker')

before(() => fs.mkdirSync(FIXTURES, { recursive: true }))
after(() => fs.rmSync(FIXTURES, { recursive: true, force: true }))

const HEADER = '# 物件追蹤\n\n| # | 日期 | 平台 | 地址 | 類型 | 價格 | 坪數 | 分數 | 狀態 | 報告 | 備註 |\n|---|------|------|------|------|------|------|------|------|------|------|\n'

test('removes duplicate rows with same normalized address', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker.md')
  fs.writeFileSync(trackerPath,
    HEADER +
    '| 001 | 2026-04-08 | 591 | 信義區忠孝東路五段1號3F | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](...) | - |\n' +
    '| 002 | 2026-04-09 | 樂屋 | 信義區忠孝東路五段1號三樓 | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [002](...) | dup |\n'
  )

  const removed = await dedupTracker({ trackerPath })
  assert.equal(removed, 1)

  const content = fs.readFileSync(trackerPath, 'utf8')
  const rows = content.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))
  assert.equal(rows.length, 1)
})

test('keeps rows with different addresses', async () => {
  const trackerPath = path.join(FIXTURES, 'tracker2.md')
  fs.writeFileSync(trackerPath,
    HEADER +
    '| 001 | 2026-04-08 | 591 | 信義區忠孝東路五段1號3F | 租 | 22,000/月 | 15坪 | 4.2/5 | Evaluated | [001](...) | - |\n' +
    '| 002 | 2026-04-09 | 591 | 大安區和平東路一段5號2F | 租 | 19,000/月 | 13坪 | 3.8/5 | Evaluated | [002](...) | - |\n'
  )

  const removed = await dedupTracker({ trackerPath })
  assert.equal(removed, 0)

  const content = fs.readFileSync(trackerPath, 'utf8')
  const rows = content.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| #') && !l.startsWith('|---'))
  assert.equal(rows.length, 2)
})
```

- [ ] **Step 2: Run tests — expect fail**

```bash
node --test tests/dedup-tracker.test.mjs
```

- [ ] **Step 3: Implement dedup-tracker.mjs**

```javascript
// dedup-tracker.mjs
import fs from 'node:fs'
import { normalizeAddress } from './lib/normalize-address.mjs'

export async function dedupTracker({ trackerPath = 'data/tracker.md' } = {}) {
  const content = fs.readFileSync(trackerPath, 'utf8')
  const lines = content.split('\n')

  const headerLines = []
  const dataLines = []
  let inData = false

  for (const line of lines) {
    if (line.startsWith('|---')) {
      headerLines.push(line)
      inData = true
    } else if (!inData) {
      headerLines.push(line)
    } else if (line.startsWith('| ') && !line.startsWith('| #')) {
      dataLines.push(line)
    }
    // blank lines and trailing content after the table are intentionally dropped
    // to prevent blank lines accumulating between data rows on repeated merges
  }

  const seen = new Set()
  const unique = []
  let removed = 0

  for (const row of dataLines) {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 4) { unique.push(row); continue }
    const address = cols[3] // 4th column (0-indexed: #, date, portal, address)
    const key = normalizeAddress(address)
    if (seen.has(key)) {
      removed++
    } else {
      seen.add(key)
      unique.push(row)
    }
  }

  const result = headerLines.join('\n').replace(/\n+$/, '') + '\n' + unique.join('\n') + '\n'
  fs.writeFileSync(trackerPath, result)

  return removed
}

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  dedupTracker().then(removed => {
    console.log(removed > 0 ? `Removed ${removed} duplicate(s)` : 'No duplicates found')
  }).catch(err => { console.error(err); process.exit(1) })
}
```

- [ ] **Step 4: Run all tests — expect pass**

```bash
node --test tests/**/*.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add dedup-tracker.mjs tests/dedup-tracker.test.mjs
git commit -m "feat: add dedup-tracker script with tests"
```

---

## Task 7: CLAUDE.md

The entry point that Claude reads on every session. Contains: mode routing table, onboarding flow, data contract, first-session setup checks.

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

Content must include (in order):
1. **What is tw-house-ops** — one paragraph
2. **First-session checks** — silent checks for 5 files, copy `_profile.template.md` if missing
3. **Onboarding flow** — 7 steps (from spec)
4. **Main files table** — key files and their purpose
5. **Mode routing table** — user intent → mode file
6. **Skill modes** — prose description of each mode trigger
7. **Auto-pipeline logic** — URL paste detection, Phase 1 quick filter, Phase 2 full eval
8. **Report conventions** — naming, numbering, path
9. **TSV / tracker pipeline integrity rules** — 5 rules from spec
10. **Data contract** — user layer vs system layer
11. **Ethical use note** — never submit without user review; favour quality over volume

The file should be written in English (following career-ops convention where CLAUDE.md is English even for non-English-market tools).

- [ ] **Step 2: Verify required sections are present**

```bash
grep -c "Mode Routing\|Onboarding\|Data Contract\|Pipeline Integrity\|Auto-pipeline\|Ethical" CLAUDE.md
```

Expected output: `6` (all 6 section keywords found)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add CLAUDE.md with mode routing, onboarding, and data contract"
```

---

## Task 8: modes/_shared.md

Shared context injected into every evaluation. Contains: scoring dimensions with weights by buyer_type, Taiwan market knowledge, canonical terminology, address normalization rules for the agent.

**Files:**
- Create: `modes/_shared.md`

- [ ] **Step 1: Write modes/_shared.md**

Must contain:
- Scoring dimension table (5 dimensions × rent/buy weights)
- `buyer_type` adjustment rules (first_time → 青安 calc, upgrader → 房地合一稅)
- Taiwan market knowledge:
  - 921 earthquake cutoff (1999): buildings before this date have weaker seismic standards
  - 海砂屋 (chloride-contaminated concrete) risk period: approx. 1980s–1990s builds
  - 輻射屋 (radiation-contaminated) risk period: 1982–1984
  - 房地合一稅 rates by holding period: <2yr=45%, 2-5yr=35%, 5-10yr=20%, >10yr=15%
  - 青安貸款 eligibility: age ≤ 40, no existing property, rate approx. 1.775%
  - 實價登錄: government price registry, 6-month lookback is standard comparison window
- Address normalization rules (same 5 rules as lib/normalize-address.mjs)
- Report format conventions (table for data, prose for reasoning)
- TSV format reminder (11 columns, column names and order)
- Phase 1 quick filter criteria

- [ ] **Step 2: Commit**

```bash
git add modes/_shared.md
git commit -m "feat: add modes/_shared.md with scoring dimensions and TW market knowledge"
```

---

## Task 9: modes/_profile.template.md

User's personal context file. Copied silently to `modes/_profile.md` on first run. Users edit `_profile.md`, never `_profile.template.md`.

**Files:**
- Create: `modes/_profile.template.md`

- [ ] **Step 1: Write modes/_profile.template.md**

```markdown
# User Profile — tw-house-ops

<!-- This file is YOUR customization layer. Edit _profile.md (not this template).
     _profile.md is injected into every evaluation to personalize scoring. -->

## Search Goal
<!-- What are you looking for? One paragraph. -->
[Fill in: e.g., "Looking for a 2-bedroom rental in Taipei near MRT, budget 25k/month, work in Xinyi District"]

## Non-Negotiables (Deal Breakers)
<!-- These cause automatic Skip regardless of score -->
- 頂樓加蓋
- 一樓
<!-- Add yours -->

## Nice to Have
<!-- These boost score but are not required -->
- 南北採光
- 社區管理
<!-- Add yours -->

## Commute Context
<!-- Origin address and max acceptable time -->
- Commute from: [your work/school address]
- Max minutes: 40

## Buyer Context
<!-- buyer_type: renter | first_time | upgrader -->
buyer_type: renter

<!-- For first_time: -->
<!-- youth_loan_eligible: true/false -->
<!-- monthly_income: NTD -->
<!-- savings_for_downpayment: NTD -->

<!-- For upgrader: -->
<!-- current_property_value: NTD estimate -->
<!-- current_loan_remaining: NTD -->
<!-- purchase_year: YYYY -->
<!-- selling_strategy: sell_first | buy_first | simultaneous -->

## Additional Context
<!-- Anything else the evaluator should know -->
```

- [ ] **Step 2: Commit**

```bash
git add modes/_profile.template.md
git commit -m "feat: add modes/_profile.template.md user customization template"
```

---

## Task 10: modes/scan.md

Three-level scanner: Playwright direct → 實價登錄 reference → WebSearch discovery. Includes Phase 1 quick filter, dedup, pipeline entry.

**Files:**
- Create: `modes/scan.md`

- [ ] **Step 1: Write modes/scan.md**

Must contain:
1. **Execution recommendation** — run as background subagent to protect main context
2. **Configuration** — how to read portals.yml (url_template vs base_url, title_filter)
3. **Three-level strategy** — Level 1 Playwright (primary), Level 2 實價登錄 (reference), Level 3 WebSearch (discovery)
4. **Level 1 workflow** — for each tracked_portal: navigate url_template (substituting profile values) or base_url, snapshot, extract listings (title, url, address, price, size, layout), paginate if needed
5. **Level 3 verification** — Playwright liveness check on each WebSearch result before adding to pipeline; expired signals (error=true param, "no longer available", content < 300 chars)
6. **Phase 1 quick filter** — apply title_filter.property_types (include/exclude) + price vs portals.yml ceiling + size_min; output: qualified / skip
7. **Dedup workflow** — Layer 1 URL exact match, Layer 2 normalized_address match; 5 normalization rules
8. **Pipeline entry format** — `- [ ] URL | platform | district | type | price | size | layout`
9. **scan-history.tsv update** — 9 columns, all 4 status values
10. **Scan summary output** — exact format from spec

- [ ] **Step 2: Commit**

```bash
git add modes/scan.md
git commit -m "feat: add modes/scan.md portal scanner"
```

---

## Task 11: modes/rent.md

Phase 2 full rental evaluation. Reads _shared.md context. Produces Markdown report in reports/.

**Files:**
- Create: `modes/rent.md`

- [ ] **Step 1: Write modes/rent.md**

Must contain:
1. **Input handling** — URL (Playwright verify active) or pasted text or local:jds/ reference
2. **Phase 1 quick filter** — check price vs profile.budget.rent_max, size vs size_min, floor vs floor_min, age vs age_max; output: qualified/skip with reason
3. **Data extraction** — title, address, floor, size, layout, monthly rent, deposit, management fee, facilities, agent vs owner, listing date
4. **Price analysis** — fetch 實價登錄 rental data for same district, calculate rent/坪 ratio, compare to median, estimate negotiation room
5. **Commute calculation** — from profile.commute_origin to listing address via MRT walking time estimation
6. **Scoring** — 5 dimensions with rent weights (30/20/25/15/10), produce X.X/5
7. **Report generation** — exact format from spec: header table, 價格分析 (table + prose), 通勤試算 (table), 維度評分 (table + prose), 疑點清單 (table + prose), 看屋問題清單 (table)
8. **TSV output** — write to `batch/tracker-additions/{num}-{slug}.tsv`, 11 columns
9. **Report file** — write to `reports/{###}-{district}-{road-slug}-{YYYY-MM-DD}.md`
10. **Instruction to run merge-tracker** — after writing TSV

- [ ] **Step 2: Commit**

```bash
git add modes/rent.md
git commit -m "feat: add modes/rent.md rental evaluation mode"
```

---

## Task 12: modes/buy.md

Phase 2 full purchase evaluation. Extends rent.md logic with loan calculations, 實價登錄 sale prices, buyer_type-specific modules.

**Files:**
- Create: `modes/buy.md`

- [ ] **Step 1: Write modes/buy.md**

Must contain everything in rent.md logic, plus:
1. **Loan trial calculation table** — for each scenario (青安/一般, 2成/3成 down): rate, down payment amount, monthly payment, total interest over 30 years. Blue mark 青安 row if `finance.youth_loan_eligible: true`.
2. **Price per 坪 analysis** — listing price/坪 vs 實價登錄 sale median (last 6 months, same district),殺價 room estimate
3. **Building age risk flags**:
   - Built before 1999 (921 cutoff): flag seismic risk
   - Built 1982–1984: flag 輻射屋 risk
   - Built 1980s–1990s: note 海砂屋 risk
4. **For upgrader buyer_type**: inject 房地合一稅 estimate in risk section (calculate from current_property.purchase_year → holding period → rate table)
5. **Scoring weights** — buy weights (35/20/20/15/10)

- [ ] **Step 2: Commit**

```bash
git add modes/buy.md
git commit -m "feat: add modes/buy.md purchase evaluation mode"
```

---

## Task 13: modes/afford.md

Affordability calculator for first_time buyers. Not an evaluator — outputs a planning table.

**Files:**
- Create: `modes/afford.md`

- [ ] **Step 1: Write modes/afford.md**

Must contain:
1. **Input** — read from profile: monthly_income, savings, youth_loan_eligible
2. **Max affordable price calculation**:
   - Bank rule of thumb: monthly payment ≤ 30% of gross income
   - Back-calculate max loan from monthly payment ceiling and interest rate
   - Max total price = max loan / 0.8 (assuming 20% down)
3. **Loan plan table** — 青安 vs 一般, 20%/30% down, show: total price, down payment, monthly payment, total interest
4. **Ranked district table** — for each district in profile.regions: fetch 實價登錄 median price/坪, calculate: how many 坪 budget buys, whether budget is sufficient for target size_min
5. **Output** — formatted tables + prose recommendation. No report file written (this is a planning mode, not an evaluation).

- [ ] **Step 2: Commit**

```bash
git add modes/afford.md
git commit -m "feat: add modes/afford.md affordability calculator"
```

---

## Task 14: modes/switch.md

Dual-track upgrade planner. Helps upgrader buyer_type decide timing and strategy.

**Files:**
- Create: `modes/switch.md`

- [ ] **Step 1: Write modes/switch.md**

Must contain:
1. **Input** — read from profile: current_property (estimated_value, loan_remaining, purchase_year, selling_strategy), budget.buy_max
2. **Track A — Sell old property**:
   - Estimated net proceeds: estimated_value − loan_remaining − transaction costs (~6%)
   - 房地合一稅 calculation: holding years from purchase_year → applicable rate → estimated tax on gain (assume 10% gain for estimate if unknown)
   - Net-of-tax proceeds table
3. **Track B — Buy new property**:
   - Required down payment for target price range
   - Bridge financing gap: if net proceeds < down payment, show shortfall
4. **Strategy comparison table** — sell_first / buy_first / simultaneous: pros, cons, financial risk, recommended for user's situation
5. **Recommendation** — prose: given profile numbers, which strategy minimizes risk
6. **Output** — tables + prose. No report file written.

- [ ] **Step 2: Commit**

```bash
git add modes/switch.md
git commit -m "feat: add modes/switch.md upgrade planner"
```

---

## Task 15: modes/compare.md

Multi-listing side-by-side comparison from existing reports.

**Files:**
- Create: `modes/compare.md`

- [ ] **Step 1: Write modes/compare.md**

Must contain:
1. **Input** — 2–N report numbers (e.g., "compare 001, 003, 007") or "compare all Evaluated"
2. **Data extraction** — read each report file from reports/, extract: score, price, size, district, commute, age, elevator, all 5 dimension scores
3. **Comparison table** — all listings as columns, all dimensions as rows, prices normalised to /坪 for fair comparison
4. **Ranking** — sort by total score descending
5. **Verdict table** — per listing: biggest advantage, biggest concern, recommended action (visit / skip / already visited)
6. **Decision recommendation** — prose: "If you can only visit one, visit X because..."
7. **Output** — tables + prose. No new report file written.

- [ ] **Step 2: Commit**

```bash
git add modes/compare.md
git commit -m "feat: add modes/compare.md multi-listing comparison"
```

---

## Task 16: modes/visit.md

Visit preparation and post-visit recording.

**Files:**
- Create: `modes/visit.md`

- [ ] **Step 1: Write modes/visit.md**

Must contain:
1. **Input** — report number (e.g., "prepare visit for 001"); reads reports/001-*.md
2. **Universal checklist** — items always checked regardless of listing:
   - 漏水痕跡 (water damage — check ceiling, walls behind furniture)
   - 手機訊號 (check all rooms)
   - 採光實測 (open all curtains, check each room at time of visit)
   - 隔音 (listen for neighbors, road noise)
   - 管委會 (ask: is there one? monthly fee? minutes available?)
   - 熱水器年份 (gas/electric, age, last serviced)
   - 水管/排水 (run all taps simultaneously, flush toilet)
   - 門窗密封 (open/close all, check seals)
3. **Property-specific checklist** — generated from the report's 疑點清單 (e.g., if flagged: "廚房右側牆面" → "Inspect right kitchen wall closely for moisture/staining")
4. **Negotiation strategy table**:
   - Opening price (listing price)
   - 實價登錄 median for comparable properties
   - Suggested first offer (typically 實登 median or 5% below listing)
   - Walk-away price
   - Leverage points (days on market, any flagged issues)
5. **Post-visit record template** (markdown form):
   ```markdown
   ## Post-Visit Record — Report 001
   Date visited: 
   Overall impression (1–5): 
   Checklist notes:
   - [ ] 漏水: 
   - [ ] 採光: 
   Deal-breakers found: 
   Decision: proceed / pass
   Notes: 
   ```
6. **After user fills record** — update tracker.md: status `Visit` → `Visited`, append notes to notes column

- [ ] **Step 2: Commit**

```bash
git add modes/visit.md
git commit -m "feat: add modes/visit.md visit preparation and recording"
```

---

## Task 17: modes/pipeline.md

Batch processor: iterates `data/pipeline.md` unchecked entries, routes each to rent or buy mode, updates pipeline checkbox when done.

**Files:**
- Create: `modes/pipeline.md`

- [ ] **Step 1: Write modes/pipeline.md**

Must contain:
1. **Input** — reads `data/pipeline.md`, finds all `- [ ]` entries
2. **Per-entry processing**:
   a. Detect type from entry metadata (租 vs 買 column)
   b. Apply Phase 1 quick filter (price, size, age, MRT from profile)
   c. If `skip`: mark entry `- [x] SKIP` in pipeline.md, record in scan-history.tsv as `skipped_title`
   d. If `qualified`: run full rent.md or buy.md evaluation, write report + TSV
   e. Mark entry `- [x]` in pipeline.md when done
3. **After all entries**: run `node merge-tracker.mjs`
4. **Summary output** — table: entries processed, qualified, skipped, reports written
5. **Execution recommendation** — run as subagent to protect main context

- [ ] **Step 2: Commit**

```bash
git add modes/pipeline.md
git commit -m "feat: add modes/pipeline.md batch pipeline processor"
```

---

## Task 18: Integration Validation

Verify the full system works end-to-end via a dry-run onboarding simulation.

**Files:** None new — validation only

- [ ] **Step 1: Run all Node.js tests**

```bash
node --test tests/**/*.test.mjs
```

Expected: all pass

- [ ] **Step 2: Verify repo structure matches spec**

```bash
ls modes/ config/ templates/ data/ batch/tracker-additions/
```

Expected: all spec-required files present

- [ ] **Step 3: Verify CLAUDE.md contains all required routing entries**

```bash
grep -E "rent\.md|buy\.md|scan\.md|afford\.md|switch\.md|compare\.md|visit\.md|pipeline\.md" CLAUDE.md | wc -l
```

Expected: at least 8 lines (one per mode file)

- [ ] **Step 4: Smoke test merge-tracker.mjs CLI**

```bash
node merge-tracker.mjs
```

Expected: `No TSV files to merge.`

- [ ] **Step 5: Smoke test verify-pipeline.mjs CLI**

```bash
node verify-pipeline.mjs
```

Expected: `✓ Pipeline integrity OK` (empty tracker, no reports, no unmerged TSVs)

- [ ] **Step 6: Smoke test dedup-tracker.mjs CLI**

```bash
node dedup-tracker.mjs
```

Expected: `No duplicates found`

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete tw-house-ops v0.1.0 — all modes and scripts integrated"
```

---

## Summary

| Task | Deliverable | Testable? |
|------|-------------|-----------|
| 1 | Repo scaffold | Manual ls check |
| 2 | Static configs (states, profile, portals) | Manual review |
| 3 | Address normalization lib | `node --test` |
| 4 | merge-tracker.mjs | `node --test` |
| 5 | verify-pipeline.mjs | `node --test` |
| 6 | dedup-tracker.mjs | `node --test` |
| 7 | CLAUDE.md | grep section check |
| 8 | modes/_shared.md | Manual review |
| 9 | modes/_profile.template.md | Manual review |
| 10 | modes/scan.md | Manual review |
| 11 | modes/rent.md | Manual review |
| 12 | modes/buy.md | Manual review |
| 13 | modes/afford.md | Manual review |
| 14 | modes/switch.md | Manual review |
| 15 | modes/compare.md | Manual review |
| 16 | modes/visit.md | Manual review |
| 17 | modes/pipeline.md | Manual review |
| 18 | Integration validation | All tests + smoke |
