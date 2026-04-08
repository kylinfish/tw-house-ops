# Switch Mode — Upgrade Planner

<!-- For upgrader buyer_type only. Read modes/_shared.md first. -->
<!-- This is a planning mode — no property report or tracker entry is written. -->

---

## Overview

Helps an upgrader (existing homeowner planning to sell and buy) analyze the financial mechanics of their move: net proceeds from selling, gap analysis for the new purchase, and strategy comparison (sell first / buy first / simultaneous). No report file is written.

---

## Section 1: Input Validation

Read from `config/profile.yml`:
- `search.buyer_type` — must be `upgrader`
- `current_property.estimated_value` — estimated current market value (TWD)
- `current_property.loan_remaining` — outstanding mortgage balance (TWD)
- `current_property.purchase_year` — year originally purchased
- `current_property.selling_strategy` — `sell_first` | `buy_first` | `simultaneous`
- `budget.buy_max` — target new property price ceiling
- `budget.monthly_payment_max` — max monthly payment for new mortgage

**If `buyer_type ≠ upgrader`:**
Output: "此模式適用於換屋族 (buyer_type: upgrader)。如需一般買屋分析請使用 buy 模式，首購規劃請使用 afford 模式。" and stop.

**If any `current_property` field is null:**
Ask the user to provide the missing value(s) before proceeding.

---

## Section 2: Track A — Selling the Current Property

### 2a: 房地合一稅 Estimate

- Holding years = current year − `current_property.purchase_year`
- Tax rate:
  - < 2 years: 45%
  - 2–5 years: 35%
  - 5–10 years: 20%
  - > 10 years: 15%
- Estimated gain = `estimated_value × 10%` (conservative assumption if purchase price unknown)
- Estimated tax = gain × rate
- Note: self-occupied property held ≥ 2 years with registered address may qualify for 10% rate — mention if applicable

### 2b: Net Proceeds Table

| 項目 | 金額 |
|------|------|
| 預估售價 | {estimated_value} |
| 未還房貸 | −{loan_remaining} |
| 交易成本 (估6%: 仲介+代書+稅費) | −{cost} |
| 房地合一稅 (估算) | −{tax} |
| **淨回款 (Net Proceeds)** | **{net}** |

Prose: Explain key assumptions (10% gain estimate, 6% transaction cost). Remind user that actual tax depends on declared sale and purchase prices. Recommend consulting a 代書 (land administrator) for precise figures.

---

## Section 3: Track B — Buying the New Property

### 3a: Down Payment Requirement

For each down payment scenario using `budget.buy_max`:

| 方案 | 目標總價 | 頭期款需求 | 淨回款(可用) | 缺口 |
|------|---------|-----------|------------|------|
| 20% 頭期 | {buy_max} | {buy_max×20%} | {net} | {gap or "無缺口"} |
| 30% 頭期 | {buy_max} | {buy_max×30%} | {net} | {gap or "無缺口"} |

Gap = required down payment − net proceeds (if positive, shows shortfall; if negative, shows surplus)

### 3b: Remaining Loan Estimate

For the scenario where net proceeds cover the down payment:
- Remaining loan = target price − down payment (from proceeds)
- Monthly payment at 2.1% over 30 years
- Compare to `budget.monthly_payment_max`

| 貸款金額 | 月付估算 (2.1%, 30年) | 月付上限 | 是否可負擔 |
|---------|---------------------|---------|-----------|
| {loan} | {monthly} | {max} | ✅/⚠️ |

---

## Section 4: Strategy Comparison

| 策略 | 優點 | 缺點 | 財務風險 | 建議情境 |
|------|------|------|---------|---------|
| **先賣後買** | 資金確定，無橋接壓力；議價能力強 | 中間需暫租，熱市難搶屋；心理壓力大 | 低 | 資金緊、不確定性高時 |
| **先買後賣** | 一次搬遷無縫接軌；從容選屋不急 | 短期雙重房貸壓力；需額外流動資金 | 高 | 資金充裕、確定舊屋好賣時 |
| **同步進行** | 省去過渡租期；時間成本最短 | 買賣時間協調難度高；議價空間受限 | 中 | 行情穩定、換屋成熟市場、有好仲介 |

**For your situation** row: Based on the user's net proceeds, gap analysis, and `current_property.selling_strategy` preference, which strategy fits best? Add a row:

| **您的情況** | {tailored analysis based on numbers} | {main risk} | {calculated risk level} | {recommendation} |

---

## Section 5: Recommendation

Prose:
1. **Net proceeds summary:** Is the estimated net sufficient for the target down payment?
2. **Strategy recommendation:** Given the numbers, which strategy minimizes risk? Align with or challenge the user's stated `selling_strategy` preference if numbers suggest otherwise.
3. **Key risks to flag:**
   - If holding < 2 years: high tax rate makes selling now very costly
   - If gap is large: bridge financing or price range adjustment needed
   - If monthly payment > monthly_payment_max: budget adjustment needed
4. **Suggested next steps:** When ready to evaluate specific properties, use `buy` mode. Use `scan` to search target districts.

**Output only** — no report file, no TSV, no tracker entry.
