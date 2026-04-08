# tw-house-ops

AI-powered house hunting pipeline for Taiwan, built on Claude Code. Automates listing discovery, evaluation, and tracking across rental and purchase markets.

---

## What it does

- **Scans** 591, 樂屋網, 信義, 永慶, 東森, 住商 for new listings matching your criteria
- **Evaluates** each listing: price vs market (實價登錄), commute, scoring across 5 dimensions
- **Tracks** every property you've considered in a structured Markdown table
- **Plans** affordability (first-time buyers) and upgrade logistics (upgraders)
- **Prepares** visit checklists and negotiation strategies from evaluation reports

Supports three buyer personas: **renter**, **first-time buyer**, **upgrader**.

---

## Quick start

1. Clone the repo and open it in Claude Code
2. Claude will detect missing config and walk you through onboarding (7 steps, ~5 minutes)
3. After setup, paste any listing URL to evaluate it — or say `scan` to search your target regions

---

## Usage

| Say... | What happens |
|--------|-------------|
| Paste a listing URL | Auto-detect rent vs buy → evaluate → write report |
| `scan` | Search portals for new listings in your target regions |
| `pipeline` | Process all pending URLs in `data/pipeline.md` |
| `compare 001, 003` | Side-by-side comparison of two evaluated properties |
| `prepare visit for 001` | Visit checklist + negotiation strategy for report 001 |
| `affordability` | Calculate max affordable price and district fit (first-time buyers) |
| `upgrade plan` | Sell + buy timing and gap analysis (upgraders) |
| `tracker` | Summary of all tracked properties |

---

## Repository structure

```
tw-house-ops/
├── CLAUDE.md                    # Entry point: mode routing, onboarding, data contract
├── config/
│   ├── profile.yml              # Your preferences (never auto-overwritten)
│   └── profile.example.yml      # Template
├── portals.yml                  # Portal URLs and search config
├── modes/
│   ├── _shared.md               # Scoring dimensions, TW market knowledge
│   ├── _profile.md              # Your personal context (injected into every eval)
│   ├── _profile.template.md     # Template for _profile.md
│   ├── scan.md                  # Portal scanner
│   ├── rent.md                  # Rental evaluation
│   ├── buy.md                   # Purchase evaluation
│   ├── afford.md                # Affordability calculator
│   ├── switch.md                # Upgrade planner
│   ├── compare.md               # Multi-listing comparison
│   ├── visit.md                 # Visit checklist + post-visit record
│   └── pipeline.md              # Batch pipeline processor
├── data/
│   ├── pipeline.md              # Pending URL inbox
│   ├── tracker.md               # Master listing tracker
│   └── scan-history.tsv         # Dedup log (gitignored)
├── reports/                     # Per-listing evaluation reports
├── batch/tracker-additions/     # TSV files pending merge
├── templates/states.yml         # Canonical tracker statuses
├── merge-tracker.mjs            # Merge TSV additions into tracker.md
├── verify-pipeline.mjs          # Validate pipeline integrity
└── dedup-tracker.mjs            # Remove duplicate tracker entries
```

---

## Evaluation scoring

Properties are scored 0–5 across five dimensions:

| Dimension | Rent weight | Buy weight |
|-----------|-------------|------------|
| 價格合理性 (Price reasonableness) | 30% | 35% |
| 空間與格局 (Space & layout) | 20% | 20% |
| 區域生活機能 (Location & amenities) | 25% | 20% |
| 物件條件 (Property condition) | 15% | 15% |
| 風險/潛力 (Risk / upside) | 10% | 10% |

Score interpretation: ≥4.0 → 推薦看屋 · 3.5–3.9 → 持保留態度 · <3.5 → 建議跳過

---

## Tracker statuses

`Scanned` → `Evaluated` → `Visit` → `Visited` → `Offer` → `Negotiating` → `Signed` → `Done`

Also: `Skip` (filtered out), `Pass` (rejected after viewing), `Expired` (listing taken down)

---

## Data contract

**User layer** (never auto-overwritten): `config/profile.yml`, `modes/_profile.md`, `data/*`, `reports/*`

**System layer** (may be updated): all mode files, `CLAUDE.md`, `*.mjs` scripts, `templates/*`

---

## Scripts

```bash
node merge-tracker.mjs    # Merge pending TSV additions into tracker.md
node verify-pipeline.mjs  # Check pipeline integrity
node dedup-tracker.mjs    # Remove duplicate tracker entries
node --test tests/**/*.test.mjs  # Run all tests
```

---

## Ethical use

This system is for quality-focused house hunting. Claude will not submit offers, sign contracts, or send applications without explicit user approval. Properties scoring below 3.5/5 are flagged as not worth pursuing.
