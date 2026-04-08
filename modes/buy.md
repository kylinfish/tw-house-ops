# Buy Mode — Purchase Property Evaluation

<!-- Read modes/_shared.md and modes/_profile.md before executing this mode. -->

---

## Overview

Full evaluation of a purchase listing. Two phases:
- **Phase 1** — Quick filter: price, size, floor, age
- **Phase 2** — Full evaluation: extraction, price/loan analysis, commute, age risks, scoring, report

Buy mode extends rent mode with loan calculations, 實價登錄 sale prices, and buyer_type-specific modules.

---

## Section 1: Input Handling

### URL input
1. `browser_navigate` to the URL
2. `browser_snapshot`
3. **Verify active:** listing title + price + contact section present. If only nav/footer → "此物件已下架或不再提供。" and stop.
4. **NEVER** use WebSearch or WebFetch alone for liveness checks.

### Pasted text
Proceed directly to Phase 1 using the provided content.

---

## Section 2: Phase 1 Quick Filter

Read `config/profile.yml`. If any fail → `Skipped: {reason} ({actual} vs limit {limit})`, no full report.

| Check | Profile field | Fail condition |
|-------|---------------|----------------|
| Price | `budget.buy_max` | 總價 > buy_max |
| Size | `property.size_min` | 坪數 < size_min |
| Floor | `property.floor_min` | Floor < floor_min |
| Building age | `property.age_max` | Age > age_max |

Also check `modes/_profile.md` deal_breakers. If any match → Skip.

If all pass → `Phase 1 通過 — 開始完整評估。`

---

## Section 3: Data Extraction

| Field | Notes |
|-------|-------|
| 標題 | Full listing title |
| 地址 | District + road + floor |
| 樓層/總樓 | Floor / total floors |
| 坪數 | Size in 坪 (主建物 + 附屬 + 公設) |
| 格局 | Layout (e.g., 3房2廳2衛) |
| 總價 | Total purchase price (TWD) |
| 車位 | Parking included? Price if separate |
| 管理費 | Monthly management fee |
| 屋齡 | Building age (years) or year built |
| 型態 | 公寓/華廈/大樓/透天/套房 |
| 電梯 | Yes/No |
| 土地/建物所有權 | Land ownership type |
| 屋主 vs 仲介 | Owner or agent |
| 刊登日 | Listing date |
| 在市場天數 | Days on market (if available) |
| 平台 | Portal name |

---

## Section 4: Price Analysis

1. **Price per 坪:** `總價 ÷ 坪數`
2. **市場行情:** WebSearch or 實價登錄 for same district, comparable type, last 6 months. Get median price/坪.
3. **Premium/discount:** `(listing/坪 − median/坪) ÷ median/坪 × 100%`
4. **殺價空間:** If listing >5% above median → estimate negotiation room

| 項目 | 數值 |
|------|------|
| 總價 | {price} |
| 坪數 | {size}坪 |
| 單坪均價 | {per_ping}/坪 |
| 同區行情中位數/坪 (近6個月) | {median}/坪 |
| 相對行情 | ±{pct}% |
| 殺價空間估算 | {note} |

---

## Section 5: Building Age Risk Assessment

Calculate year built = current year − building age.

| Year built | Flag |
|------------|------|
| Before 1999 | ⚠️ **921 前建物**: 建議確認結構安全鑑定 (seismic risk — add to 疑點清單, level 中) |
| 1982–1984 | 🔴 **輻射屋風險期**: 須委託專業輻射檢測，此為最高優先 (add to 疑點清單, level 高) |
| 1980s–1990s | ⚠️ **海砂屋風險期**: 建議要求氯離子含量報告 (add to 疑點清單, level 中) |

Note: A 1982–1984 building triggers both the 輻射屋 flag AND the 921 flag if also pre-1999.

---

## Section 6: Loan Trial Calculation

Calculate for all applicable scenarios. Show monthly payment and total interest over 30 years.

**Formula:** Monthly payment = P × [r(1+r)^n] / [(1+r)^n − 1]
where P = loan principal, r = annual rate / 12, n = 360

Scenarios:
- 青安 20%: rate 1.775%, down payment = 總價 × 20%, loan = 總價 × 80% (only if `finance.youth_loan_eligible: true`)
- 青安 30%: rate 1.775%, down payment = 總價 × 30%, loan = 總價 × 70% (only if eligible)
- 一般 20%: rate 2.1%, down payment = 總價 × 20%, loan = 總價 × 80%
- 一般 30%: rate 2.1%, down payment = 總價 × 30%, loan = 總價 × 70%

| 方案 | 利率 | 頭期款 | 月付 | 30年總利息 |
|------|------|--------|------|------------|
| ★ 青安 20% | 1.775% | {amount} | {monthly} | {total interest} |
| ★ 青安 30% | 1.775% | {amount} | {monthly} | {total interest} |
| 一般 20% | 2.1% | {amount} | {monthly} | {total interest} |
| 一般 30% | 2.1% | {amount} | {monthly} | {total interest} |

★ = 青安貸款 (only show if `finance.youth_loan_eligible: true`)

Flag any row where monthly payment > `budget.monthly_payment_max` with ⚠️.

If buyer_type = first_time: add note confirming/questioning 青安 eligibility based on profile.

---

## Section 7: Commute Calculation

Same as rent.md. From `user.commute_origin` to listing address. Estimate MRT walk time + bus option. Compare to `user.commute_max_minutes`.

| 交通方式 | 預估時間 | 備註 |
|---------|---------|------|
| 捷運步行 | X 分鐘 | 最近捷運站: {station} |
| 公車 | X 分鐘 | 路線: {route} |

---

## Section 8: Scoring

Score each dimension 0–5. Apply BUY weights.

| Dimension | Weight | Key factors |
|-----------|--------|-------------|
| 價格合理性 | 35% | Price/坪 vs market median, monthly payment vs monthly_payment_max; if first_time: 青安 affordability; days on market |
| 空間與格局 | 20% | Size, layout efficiency, floor, natural light, storage, parking |
| 區域生活機能 | 20% | MRT walk vs mrt_walk_max, lifestyle priorities, neighborhood trajectory |
| 物件條件 | 15% | Building type, age, elevator, parking, management committee, legal status, ownership type |
| 風險/潛力 | 10% | Building age risks (輻射/海砂/921), legal flags, days on market; if upgrader: 房地合一稅 estimate |

**Upgrader supplement** (if `buyer_type = upgrader`):
- Calculate 房地合一稅 estimate from `current_property.purchase_year`:
  - Holding years = current year − purchase_year
  - Tax rate: <2yr=45%, 2–5yr=35%, 5–10yr=20%, >10yr=15%
  - Estimated tax = (current_property.estimated_value − original cost) × rate
  - If original cost unknown: assume gain = estimated_value × 10%
- Include in 疑點清單 and factor into 風險/潛力 score

**Final score:** `(D1×0.35 + D2×0.20 + D3×0.20 + D4×0.15 + D5×0.10)`

**Score interpretation:**
- ≥ 4.0: **推薦看屋**
- 3.5–3.9: **持保留態度**
- < 3.5: **建議跳過**

---

## Section 9: Report Generation

### 9a: Determine report number
Read `reports/` filenames. Find highest `{###}`. New = max + 1, zero-padded. Start at `001` if empty.

### 9b: Build filename
`{###}-{district}-{road-slug}-{YYYY-MM-DD}.md` (see _shared.md for romanization rules)

### 9c: Write report to `reports/{filename}`

```markdown
# {###} | {district}{road}{floor}

| 欄位 | 內容 |
|------|------|
| 類型 | 買屋 |
| 分數 | {score}/5 — {interpretation} |
| URL | {url} |
| 總價 | {price} | 坪數 | {size} | 格局 | {layout} |
| 屋齡 | {age}年 | 樓層 | {floor}/{total} | 平台 | {portal} |

**URL:** {url}
**Score:** {score}/5
**Type:** buy
**Status:** Evaluated
**Verification:** confirmed

## 價格分析

{price table}
{price prose}

## 貸款試算

{loan table}
{loan prose: recommendation based on buyer_type; note if any scenario exceeds monthly_payment_max}

## 通勤試算

{commute table}
{commute prose}

## 維度評分

| 維度 | 分數 | 主要因素 |
|------|------|---------|
| 價格合理性 | {d1}/5 | {factors} |
| 空間與格局 | {d2}/5 | {factors} |
| 區域生活機能 | {d3}/5 | {factors} |
| 物件條件 | {d4}/5 | {factors} |
| 風險/潛力 | {d5}/5 | {factors} |
| **綜合** | **{total}/5** | |

{prose: recommendation rationale}

## 疑點清單

| # | 疑點 | 風險等級 |
|---|------|---------|
| 1 | {issue} | 高/中/低 |

{prose: explanation of significant risks}

## 看屋問題清單

| # | 問題 | 類別 |
|---|------|------|
| 1 | {question} | 結構/設備/環境/法務/產權 |
```

---

## Section 10: TSV Output

Write `batch/tracker-additions/{num}-{slug}.tsv`:
```
{num}\t{YYYY-MM-DD}\t{portal}\t{address}\t買\t{price}\t{size}坪\t{score}/5\tEvaluated\t[{num}](reports/{report_filename})\t{one-line note}
```

---

## Section 11: Merge Tracker

Run: `node merge-tracker.mjs`
