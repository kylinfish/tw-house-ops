# Rent Mode — Rental Property Evaluation

<!-- Read modes/_shared.md and modes/_profile.md before executing this mode. -->

---

## Overview

Full evaluation of a rental listing. Two phases:
- **Phase 1** — Quick filter (seconds): price, size, floor, age
- **Phase 2** — Full evaluation: data extraction, price analysis, commute, scoring, report

---

## Section 1: Input Handling

### URL input (most common)
1. `browser_navigate` to the URL
2. `browser_snapshot` to read the page
3. **Verify listing is active:**
   - Active: listing title + description + price + contact/apply section all present
   - Inactive: only nav and footer visible, no listing content → output "此物件已下架或不再提供。" and stop
4. **NEVER** use WebSearch or WebFetch alone to verify listing status. Always use Playwright.

### Pasted text input
Proceed directly to Phase 1 using the provided content.

---

## Section 2: Phase 1 Quick Filter

Read `config/profile.yml`. Check each criterion. If **any** fails:
- Output: `Skipped: {reason} ({actual value} vs limit {limit value})`
- Do NOT write a full report
- Optionally write a minimal TSV with status `Skip`
- Stop

| Check | Profile field | Fail condition |
|-------|---------------|----------------|
| Price | `budget.rent_max` | Monthly rent > rent_max |
| Size | `property.size_min` | Listed 坪數 < size_min |
| Floor | `property.floor_min` | Floor number < floor_min |
| Building age | `property.age_max` | Building age (years) > age_max |

Also check `modes/_profile.md` deal_breakers: if any match the listing → Skip with reason.

If all pass: output `Phase 1 通過 — 開始完整評估。` and proceed to Phase 2.

---

## Section 3: Data Extraction

Extract from the listing page:

| Field | Notes |
|-------|-------|
| 標題 | Full listing title |
| 地址 | District + road + floor (e.g., 信義區忠孝東路五段XX號3F) |
| 樓層 | Floor number / total floors |
| 坪數 | Size in 坪 |
| 格局 | Layout (e.g., 2房1廳1衛) |
| 月租 | Monthly rent (TWD) |
| 押金 | Deposit (months or amount) |
| 管理費 | Monthly management fee (0 if none) |
| 設備 | Facilities: 電梯, 停車位, 冷氣, 熱水器, 洗衣機, 冰箱 |
| 型態 | 公寓/華廈/大樓/透天/套房 |
| 屋齡 | Building age (years) or year built |
| 屋主 vs 仲介 | Owner-listed or via agent |
| 刊登日 | Listing date |
| 平台 | Portal name |

---

## Section 4: Price Analysis

1. **Rent per 坪:** `月租 ÷ 坪數`
2. **市場行情:** Use WebSearch or 實價登錄 to find rental median for the same district. Target: comparable size and type, last 3 months.
3. **Premium/discount:** `(listing rent/坪 − median rent/坪) ÷ median rent/坪 × 100%`
4. **Total monthly cost:** `月租 + 管理費`
5. **押金換算:** `押金 ÷ 月租` = number of months
6. **Negotiation room:** If listing is >10% above median → note estimated negotiation room

Present as a table:

| 項目 | 數值 |
|------|------|
| 月租 | {price}/月 |
| 管理費 | {fee}/月 |
| 月支出合計 | {total}/月 |
| 租/坪 | {per_ping}/月 |
| 同區行情中位數/坪 | {median}/月 |
| 相對行情 | ±{pct}% |
| 押金 | {deposit} ({months}個月) |
| 殺價空間估算 | {negotiation_note} |

---

## Section 5: Commute Calculation

- **From:** `config/profile.yml → user.commute_origin`
- **To:** listing address
- **Method:** Estimate via MRT (find nearest MRT station, estimate walking time from station to listing + from station to commute destination); note bus option if relevant
- **Compare:** Total commute time vs `user.commute_max_minutes`

| 交通方式 | 預估時間 | 備註 |
|---------|---------|------|
| 捷運步行 | X 分鐘 | 最近捷運站: {station} |
| 公車 | X 分鐘 | 路線: {route} |

Prose: Is the commute within the acceptable limit? If borderline, note it.

---

## Section 6: Scoring

Score each dimension 0–5 (0=very poor, 5=excellent). Apply rent weights. Sum = final score.

| Dimension | Weight | Key factors |
|-----------|--------|-------------|
| 價格合理性 | 30% | Rent vs budget ceiling, rent vs market median, total monthly cost, deposit reasonableness |
| 空間與格局 | 20% | Size vs size_min, layout efficiency (rooms per ping), floor number, natural light, storage |
| 區域生活機能 | 25% | MRT walk time vs mrt_walk_max, lifestyle priorities (supermarket/school/hospital from profile) |
| 物件條件 | 15% | Building age, elevator, parking, appliances provided, owner vs agent, listing freshness |
| 風險/潛力 | 10% | Number and severity of 疑點, days on market, any deal_breakers, neighborhood trajectory |

**Final score:** `(D1×0.30 + D2×0.20 + D3×0.25 + D4×0.15 + D5×0.10) / 1.0`

**Score interpretation:**
- ≥ 4.0: **推薦看屋** — strong match, prioritize
- 3.5–3.9: **持保留態度** — worth considering with caveats
- < 3.5: **建議跳過** — strongly discourage pursuing; only proceed if user has specific reason

---

## Section 7: Report Generation

### 7a: Determine report number

Read filenames in `reports/`. Find the highest `{###}` prefix. New report number = max + 1, zero-padded to 3 digits. If no reports exist, start at `001`.

### 7b: Build filename

`{###}-{district}-{road-slug}-{YYYY-MM-DD}.md`
- `{district}`: romanize district (e.g., 信義區 → `xinyi`, 大安區 → `daan`, 中山區 → `zhongshan`, 萬華區 → `wanhua`, 士林區 → `shilin`, 內湖區 → `neihu`, 松山區 → `songshan`, 文山區 → `wenshan`, 南港區 → `nangang`, 北投區 → `beitou`)
- `{road-slug}`: romanize road name via pinyin, hyphenate (e.g., 忠孝東路五段 → `zhongxiao-e-rd-sec5`, 仁愛路 → `renai-rd`). If ambiguous → `road-{4-char-hex-of-address-hash}`
- `{YYYY-MM-DD}`: today's date

### 7c: Write report to `reports/{filename}`

```markdown
# {###} | {district}{road}{floor}

| 欄位 | 內容 |
|------|------|
| 類型 | 租屋 |
| 分數 | {score}/5 — {interpretation} |
| URL | {url} |
| 月租 | {rent} | 坪數 | {size} | 格局 | {layout} |
| 刊登日 | {listing_date} | 平台 | {portal} |

**URL:** {url}
**Score:** {score}/5
**Type:** rent
**Status:** Evaluated
**Verification:** confirmed

## 價格分析

{price analysis table}

{price analysis prose: interpretation and negotiation context}

## 通勤試算

{commute table}

{commute prose: assessment vs commute_max_minutes}

## 維度評分

| 維度 | 分數 | 主要因素 |
|------|------|---------|
| 價格合理性 | {d1}/5 | {key factors} |
| 空間與格局 | {d2}/5 | {key factors} |
| 區域生活機能 | {d3}/5 | {key factors} |
| 物件條件 | {d4}/5 | {key factors} |
| 風險/潛力 | {d5}/5 | {key factors} |
| **綜合** | **{total}/5** | |

{dimension prose: overall recommendation rationale, key trade-offs}

## 疑點清單

| # | 疑點 | 風險等級 |
|---|------|---------|
| 1 | {issue} | 高/中/低 |

{prose: explanation of the most significant risks; if none, write "無明顯疑點。"}

## 看屋問題清單

| # | 問題 | 類別 |
|---|------|------|
| 1 | {question} | 結構/設備/環境/法務 |
```

All sections are required. If a section has no content (e.g., no 疑點), write a brief "無。" rather than omitting it.

---

## Section 8: TSV Output

Write `batch/tracker-additions/{num}-{slug}.tsv` where `{slug}` matches the report filename minus date.

Single line, 11 tab-separated columns:
```
{num}\t{YYYY-MM-DD}\t{portal}\t{address}\t租\t{price}/月\t{size}坪\t{score}/5\tEvaluated\t[{num}](reports/{report_filename})\t{one-line note}
```

---

## Section 9: Merge Tracker

Run: `node merge-tracker.mjs`

This appends the TSV row to `data/tracker.md` and archives the TSV to `batch/tracker-additions/processed/`.
