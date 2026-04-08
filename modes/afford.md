# Afford Mode — Affordability Calculator

<!-- For first_time buyers only. Read modes/_shared.md first. -->
<!-- This is a planning mode — no property report or tracker entry is written. -->

---

## Overview

Calculates how much home a first_time buyer can actually afford, given their income and savings. Produces a loan plan table and district reality check. No report file is written.

---

## Section 1: Input Validation

Read from `config/profile.yml`:
- `finance.monthly_income` — gross monthly income (TWD)
- `finance.savings` — available for down payment (TWD)
- `finance.youth_loan_eligible` — true/false
- `property.size_min` — minimum target size (坪)
- `regions[].districts` — target districts
- `budget.buy_max` — user's stated ceiling (for comparison)

If any required field is `null` or missing, ask the user to provide it before proceeding.

Note: This mode is most relevant for `buyer_type: first_time`. It can be used by any buyer type but the 青安 section only applies when `youth_loan_eligible: true`.

---

## Section 2: Max Affordable Price Calculation

**Bank rule of thumb:** Monthly payment ≤ 30% of gross monthly income.

**Max monthly payment:** `monthly_income × 0.30`

**Loan rates:**
- 青安貸款: 1.775% per year (only if `youth_loan_eligible: true`)
- 一般貸款: 2.1% per year
- Term: 30 years (360 months)

**Loan formula (monthly payment → max principal):**
P = payment × [(1+r)^n − 1] / [r(1+r)^n]
where r = annual_rate / 12, n = 360

**For each scenario (20% down and 30% down):**
1. Calculate max loan P from max monthly payment
2. Unconstrained max total price = P / (1 − down_pct) where down_pct = 0.20 or 0.30
3. Required down payment = total_price × down_pct
4. Check: if required down payment > savings → constrained by savings:
   - Actual down payment = savings (use all savings)
   - Actual max loan = savings / down_pct × (1 − down_pct) [but also can't exceed P from income rule]
   - Actual max total price = savings + actual max loan
5. Total interest over 30 years = (monthly_payment × 360) − actual max loan

---

## Section 3: Loan Plan Table

| 方案 | 利率 | 最高房價 | 頭期款 | 月付 | 30年總利息 | 備註 |
|------|------|----------|--------|------|------------|------|
| ★ 青安 20% | 1.775% | {max_price} | {down} | {monthly} | {interest} | {note} |
| ★ 青安 30% | 1.775% | {max_price} | {down} | {monthly} | {interest} | {note} |
| 一般 20% | 2.1% | {max_price} | {down} | {monthly} | {interest} | {note} |
| 一般 30% | 2.1% | {max_price} | {down} | {monthly} | {interest} | {note} |

★ = 青安貸款 (only show if `youth_loan_eligible: true`)

Notes column: mark ⚠️ 存款不足 if required down payment > savings.

Also show: User's stated `budget.buy_max` vs the calculated max — if budget > what's affordable, call it out explicitly: "您的目標總價 {buy_max} 超過目前財力可支撐範圍 ({max_price})。"

---

## Section 4: District Price Reality Check

For each district in `profile.regions`:
1. Fetch 實價登錄 median price/坪 for that district (last 6 months) using WebSearch
2. Calculate: max affordable 坪數 = best affordable total price ÷ median price/坪
3. Check vs `property.size_min`

| 區域 | 行情中位數/坪 (近6個月) | 預算可買坪數 | 是否足夠 (≥{size_min}坪) |
|------|------------------------|-------------|------------------------|
| {district} | {median}/坪 | {坪數} | ✅ 足夠 / ⚠️ 不足 |

Sort by "是否足夠" (✅ first) then by 可買坪數 descending.

---

## Section 5: Recommendation

Prose summary:

1. **Achievable scenarios:** Which loan scenarios are realistic given savings? (highlight the best one)
2. **District fit:** Which districts fall within budget for the target size?
3. **Overall assessment:** e.g., "以您目前的收入和存款，在{district}購買{size_min}坪以上物件是最可行的方案，建議以{scenario}為主要規劃方向。"
4. **If budget is unrealistic:** Say so directly: "您的目標總價在所有方案下均超出財力範圍，建議調整目標價格或增加頭期款準備。"
5. **Next step:** Suggest using `buy` mode to evaluate specific listings, or `scan` to find options in feasible districts.

**Output only** — no report file, no TSV, no tracker entry. This is a planning consultation.
