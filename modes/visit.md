# Visit Mode — Visit Preparation and Post-Visit Recording

<!-- Read modes/_shared.md and the relevant report before executing this mode. -->

---

## Overview

Two sub-modes:
1. **Pre-visit:** Generate a visit checklist + negotiation strategy from an existing evaluation report
2. **Post-visit:** Record findings and update tracker status

---

## Sub-mode 1: Pre-Visit Preparation

### Input

User provides a report number (e.g., "prepare visit for 001" or "看屋清單 003").

1. Search `reports/` for a file starting with `{###}-`
2. If not found → "找不到報告 {###}，請確認報告編號。" and stop
3. Read the report file fully — especially 疑點清單 and 看屋問題清單 sections

---

### Section A: Universal Checklist

Items to check at every viewing regardless of listing type:

| # | 項目 | 檢查要點 |
|---|------|---------|
| 1 | 漏水痕跡 | 天花板、牆面（尤其是家具背後）、窗框周圍、浴室 |
| 2 | 手機訊號 | 各個房間、廚房、衛浴都要確認訊號強度 |
| 3 | 採光實測 | 開所有窗簾，各房間白天採光情況；注意遮擋物（鄰棟/廣告招牌） |
| 4 | 隔音測試 | 靜下來聽：鄰居聲、馬路噪音、電梯運轉聲 |
| 5 | 管委會 / 管理 | 是否有管委會？月費多少？可否索取近期會議記錄？ |
| 6 | 熱水器 | 類型（瓦斯/電熱/太陽能）、年份、上次保養時間 |
| 7 | 水管/排水 | 同時開所有水龍頭，沖馬桶，觀察排水速度 |
| 8 | 門窗密封 | 開關每扇門窗，確認密封條完整、無異音、鎖具正常 |
| 9 | 電梯（如有） | 實際搭乘，確認運作狀況、噪音、速度 |
| 10 | 停車位（如有） | 確認位置、尺寸、使用方式 |

---

### Section B: Property-Specific Checklist

Derived from the report's 疑點清單. For each 疑點 in the report:

| # | 來源疑點 | 看屋時要做什麼 |
|---|---------|-------------|
| 1 | {疑點 from report} | {specific inspection instruction} |

Conversion rules:
- 漏水跡象 → "重點查看：天花板右下角、廚房後方牆面、浴室磁磚接縫"
- 老舊管線 → "詢問屋主/仲介是否曾換管；目視是否有外露鏽管"
- 921前建物 → "詢問是否有結構安全鑑定報告；觀察柱/梁是否有裂縫"
- 輻射屋風險 → "要求提供輻射偵測報告（γ射線檢測）；若無，建議自行委託檢測"
- 海砂屋風險 → "要求提供氯離子含量報告；觀察天花板鋼筋是否有鏽跡滲出"
- 頂樓物件 → "查看屋頂防水層、天花板是否有水漬"
- 採光不足 → "實地測試各房間，比較照片與實際"

---

### Section C: Negotiation Strategy

Read the report's 價格分析 section for price vs market data.

| 項目 | 金額 | 備註 |
|------|------|------|
| 掛牌價 | {listing price} | 現況 |
| 實價登錄行情中位數 | {median} | 近6個月同區 |
| 建議出價 | {suggested offer} | 約實登中位數，或掛牌價 ×95% |
| 底線（可接受上限） | {walk-away} | 掛牌價×X% 或預算上限，取低者 |
| 槓桿點 | {leverage points} | e.g., 在市場{N}天、{疑點}需修繕 |

**Suggested first offer logic:**
- If listing is ≤5% above 實登 median: offer 實登 median directly
- If listing is >5% above: offer 5% below listing price
- Never exceed `budget.rent_max` (rent) or `budget.buy_max` (buy)

**Negotiation notes:** List any leverage points from the report (days on market, flagged issues that require repair, building age risks) that justify a lower offer.

---

### Section D: Logistics Reminder

- Bring: 身分證, 印章 (just in case), camera
- Recommended visit time: morning or midday (check natural light; avoid landlord-staged evening lighting)
- Bring a measuring tape for key rooms
- Check: garbage collection time, parking rules, neighbor demographics

---

## Sub-mode 2: Post-Visit Record

### Trigger

User has completed the viewing and wants to record findings.

### Present template for user to fill in:

```markdown
## Post-Visit Record — Report {###}

**Date visited:** {YYYY-MM-DD}
**Overall impression (1–5):** 

**Checklist notes:**
- [ ] 漏水: 
- [ ] 手機訊號: 
- [ ] 採光: 
- [ ] 隔音: 
- [ ] 管委會: 
- [ ] 熱水器: 
- [ ] 水管排水: 
- [ ] 門窗: 
- [ ] Property-specific item 1: 
- [ ] Property-specific item 2: 

**Negotiation notes:**
- Offered: 
- Counter: 
- Status: 

**Deal-breakers found:** (none / list them)

**Decision:** proceed / pass

**Notes:** 
```

### After user fills record:

1. **Update tracker.md directly** (status + notes column, direct edit allowed per CLAUDE.md):
   - Find the row with matching report number
   - Status: `Visit` → `Visited`
   - Append visit summary to notes column (e.g., "看屋2026-04-10，整體印象4/5，無漏水")

2. **If decision = pass:**
   - Update status to `Pass`
   - Note the reason in notes column

3. **If decision = proceed:**
   - Suggest next steps: make an offer → update status to `Offer`, or schedule another visit
   - Can use `compare` mode to re-evaluate against other candidates before deciding
