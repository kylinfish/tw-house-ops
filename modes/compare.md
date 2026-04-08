# Compare Mode — Multi-Listing Comparison

<!-- Read modes/_shared.md first. -->
<!-- No new report file is written — this compares existing evaluated reports. -->

---

## Overview

Side-by-side comparison of 2 or more evaluated properties. Reads existing reports, normalises prices to per-坪, ranks by score, and produces a decision recommendation.

---

## Section 1: Input

Accepted input formats:
- **Specific reports:** "compare 001, 003, 007" → compare those three reports
- **All Evaluated:** "compare all Evaluated" → find all tracker entries with status `Evaluated`, load those reports

### Resolve report files

For each report number:
1. Search `reports/` for a file starting with `{###}-` (zero-padded)
2. If not found → "找不到報告 {###}，請確認報告編號。" and skip that entry
3. If fewer than 2 valid reports → "至少需要 2 份報告才能比較。" and stop

---

## Section 2: Data Extraction

For each report file, extract:

| Field | Where to find it |
|-------|-----------------|
| 報告# | Filename prefix |
| 類型 | rent / buy (from report Type header) |
| 地址 | From report header table |
| 總價 / 月租 | From report header table |
| 坪數 | From report header table |
| 單坪均價 | Calculate: total price ÷ 坪數 (buy) or monthly rent ÷ 坪數 (rent) |
| 綜合分數 | From 維度評分 table (綜合 row) |
| 價格合理性 | From 維度評分 table |
| 空間與格局 | From 維度評分 table |
| 區域生活機能 | From 維度評分 table |
| 物件條件 | From 維度評分 table |
| 風險/潛力 | From 維度評分 table |
| 通勤時間 | From 通勤試算 table (first row, estimated minutes) |
| 主要疑點 | Top 1-2 items from 疑點清單 |
| 狀態 | From tracker.md |

If a field can't be extracted, mark it as `—`.

---

## Section 3: Comparison Table

All listings as columns, all dimensions as rows. Highlight the best value in each row.

```markdown
## 物件比較

| 欄位 | 001 | 003 | 007 |
|------|-----|-----|-----|
| 地址 | {address} | {address} | {address} |
| 類型 | 租/買 | | |
| 總價/月租 | {price} | | |
| 坪數 | {size}坪 | | |
| **單坪均價** | {per_ping} | | |
| 通勤時間 | {mins}分鐘 | | |
| **綜合分數** | **{total}/5** | | |
| 價格合理性 | {d1}/5 | | |
| 空間與格局 | {d2}/5 | | |
| 區域生活機能 | {d3}/5 | | |
| 物件條件 | {d4}/5 | | |
| 風險/潛力 | {d5}/5 | | |
| 主要疑點 | {issue} | | |
```

Bold the best value in each row (e.g., highest score, lowest per-坪 price, shortest commute).

---

## Section 4: Ranking

Sort listings by 綜合分數 descending. Present as a ranked list:

```
🥇 報告 003 — 大安區仁愛路 — 4.3/5
🥈 報告 007 — 信義區忠孝東路 — 3.9/5
🥉 報告 001 — 中山區民生東路 — 3.5/5
```

---

## Section 5: Verdict Table

Per listing: biggest advantage, biggest concern, recommended action.

| 報告 | 最大優勢 | 最大顧慮 | 建議行動 |
|------|---------|---------|---------|
| 001 | {e.g., 最低單坪價} | {e.g., 通勤最久} | 看屋 / 跳過 / 已看 |
| 003 | {e.g., 最高綜合分} | {e.g., 屋齡較高} | 看屋 / 跳過 / 已看 |
| 007 | {e.g., 通勤最短} | {e.g., 坪數偏小} | 看屋 / 跳過 / 已看 |

Recommended action logic:
- Score ≥ 4.0 → 優先看屋
- Score 3.5–3.9 → 備選看屋
- Score < 3.5 → 建議跳過
- Status already `Visited` or beyond → note current status

---

## Section 6: Decision Recommendation

Prose recommendation:

**If you can only visit one:** "如果只能看一間，建議優先看 報告 {###} — {reason based on scores and user priorities from _profile.md}。"

**Trade-off analysis:** For the top 2: "報告 {A} 在{dimension}上更優，但 報告 {B} 在{dimension}上更有優勢。如果您更重視{X}，選 {A}；如果更重視{Y}，選 {B}。"

**Skip confirmation:** If any listing scored < 3.5: "報告 {###} 分數偏低，建議不再追蹤，可在追蹤表中更新狀態為 Skip。"

**Output only** — no new report file, no TSV, no tracker changes (tracker status updates require explicit user instruction).
