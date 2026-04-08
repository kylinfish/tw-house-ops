# Shared Knowledge Base — tw-house-ops

<!-- Injected into every evaluation. Do NOT put user-specific data here.
     User customization goes in modes/_profile.md and config/profile.yml. -->

## Scoring Dimensions

Scoring is 0–5. Five dimensions, weights vary by transaction type:

| Dimension | Rent weight | Buy weight |
|-----------|-------------|------------|
| 價格合理性（Price Reasonableness） | 30% | 35% |
| 空間與格局（Space & Layout） | 20% | 20% |
| 區域生活機能（Location & Amenities） | 25% | 20% |
| 物件條件（Property Condition） | 15% | 15% |
| 風險/潛力（Risk / Upside） | 10% | 10% |

Final score = weighted average of 5 dimension scores × 5.

### buyer_type Adjustments

- **renter**: Standard rent weights. No loan calculation needed.
- **first_time**: In 價格合理性, add 青安貸款 monthly payment trial calculation. Flag youth_loan_eligible status from profile.
- **upgrader**: In 風險/潛力, add 房地合一稅 estimate based on current_property.purchase_year.

---

## Taiwan Market Knowledge

### Building Age Risk Cutoffs

- **Pre-1999** (before 921 earthquake): weaker seismic standards → flag as seismic risk
- **1982–1984**: 輻射屋 (radiation-contaminated steel) risk period → flag explicitly
- **1980s–1990s**: 海砂屋 (chloride-contaminated concrete) risk period → flag with note

### 房地合一稅 (Consolidated Housing and Land Transaction Income Tax) Rates

| Holding period | Tax rate |
|----------------|----------|
| Under 2 years | 45% |
| 2–5 years | 35% |
| 5–10 years | 20% |
| Over 10 years | 15% |
| Self-occupied (2+ years residence) | 10% |

### 青安貸款 (Youth Housing Loan)

- Eligibility: age ≤ 40, no existing property ownership, first-time buyer
- Interest rate: approximately 1.775% (verify current rate)
- Max loan: NT$8M (as of 2024 policy)
- Term: up to 30 years

### 實價登錄 (Real Price Registration)

- Government-mandated transaction price disclosure system
- Use 6-month lookback window as standard comparison period
- API: lvr.land.moi.gov.tw (query by district/address for comparable transactions)

### Standard Market Metrics

- 月租/坪 (monthly rent per ping): key rental value metric
- 總價/坪 (total price per ping): key purchase value metric
- 坪 = 3.3058 m²
- 台北市 market reference: 大安/信義 districts are premium; 萬華/中山 are mid-range

---

## Report Format Conventions

- **Key data** → use tables
- **Reasoning and interpretation** → use prose
- Never mix: don't put narrative in tables, don't put numbers in prose when a table fits
- Required report sections (in order): header table, 價格分析, 貸款試算 (buy only), 通勤試算, 維度評分, 疑點清單, 看屋問題清單

**Required header fields** (every report must include these at the top):
```
**URL:** {listing url}
**Score:** {X.X}/5
**Type:** rent | buy
**Status:** {canonical status}
**Verification:** confirmed | unconfirmed (batch mode)
```

**Report filename convention:** `{###}-{district}-{road-slug}-{YYYY-MM-DD}.md`
- `{###}`: sequential 3-digit zero-padded integer (max existing report number + 1)
- `{district}`: district romanized (e.g., `daan`, `xinyi`, `zhongshan`)
- `{road-slug}`: pinyin approximation, hyphenated; if ambiguous → `road-{4-char-hex}`
- `{YYYY-MM-DD}`: evaluation date

**Listing liveness verification:** ALWAYS use Playwright (`browser_navigate` + `browser_snapshot`). NEVER use WebSearch or WebFetch alone to determine if a listing is active. Expired signals: `error=true` URL param, "物件已下架"/"no longer available" in content, content < 300 chars with only nav/footer.

**Platform access methods:**
- 591, 樂屋網: SPA → Playwright required
- 信義, 永慶, 東森, 住商: SPA → Playwright required
- 實價登錄 (lvr.land.moi.gov.tw): Government REST API → reference data only, never populates pipeline

---

## Address Normalization Rules

Five rules for cross-platform deduplication:

1. `臺` → `台`
2. Floor suffixes: `3F` / `三樓` / `3樓` → `3F`
3. `之` subdivisions stripped: `1之3號` → `1號`
4. Full-width → half-width: `３Ｆ` → `3F`
5. Spaces removed

---

## Phase 1 Quick Filter Criteria

Apply before full evaluation. Check against profile values:

- price > budget ceiling → skip
- size < property.size_min → skip
- floor < property.floor_min → skip
- building age > property.age_max → skip
- Any item in narrative.deal_breakers found in listing → skip

Output: `qualified` (proceed to Phase 2) or `skip` (state reason, do not write report)

---

## TSV Format Reminder

11 tab-separated columns for `batch/tracker-additions/{num}-{slug}.tsv`:

1. num (3-digit zero-padded)
2. date (YYYY-MM-DD)
3. portal
4. address (district + road + floor)
5. type (租 or 買)
6. price (22,000/月 or 1,280萬)
7. size (15坪)
8. score (X.X/5)
9. status (canonical from states.yml)
10. report (markdown link)
11. notes (one line)

After writing TSV → always run `node merge-tracker.mjs`

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

Rules: no bold, no dates, no extra text in status field — use the notes column for those.
