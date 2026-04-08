# Pipeline Mode — Batch Pipeline Processor

<!-- Read modes/_shared.md first. -->

**Execution recommendation:** Run this mode as a background subagent (`Agent` tool with `run_in_background: true`) to protect the main conversation context. Processing multiple listings generates substantial output.

---

## Overview

Processes all unchecked (`- [ ]`) entries in `data/pipeline.md`. For each entry: applies Phase 1 quick filter, routes qualified listings to full evaluation (rent or buy mode), and marks entries as done.

---

## Step 1: Read Pipeline

1. Read `data/pipeline.md`
2. Find all lines matching: `- [ ] {url} | {portal} | {district} | {type} | {price} | {size} | {layout}`
3. If no unchecked entries → output "Pipeline 已清空，無待處理物件。" and stop
4. Log count: "找到 {N} 個待評估物件。"

---

## Step 2: Process Each Entry

For each `- [ ]` entry, in order:

### 2a: Parse entry fields

| Field | From entry |
|-------|-----------|
| URL | First field |
| Portal | Second field |
| District | Third field |
| Type | Fourth field: `租` → rent, `買` → buy |
| Price | Fifth field |
| Size | Sixth field (坪, parse number) |
| Layout | Seventh field |

### 2b: Apply Phase 1 Quick Filter

Check against `config/profile.yml`. For rent listings check `budget.rent_max`, for buy listings check `budget.buy_max`.

| Check | Rule |
|-------|------|
| Price | Parsed price > budget ceiling → skip |
| Size | Parsed 坪數 < `property.size_min` → skip |
| Floor | If floor visible in entry or URL → check vs `property.floor_min` |
| Age | Usually not available at this stage — skip this check |

Check `modes/_profile.md` deal_breakers against the title/address fields.

**If any check fails:**
- Mark entry in pipeline.md: `- [x] SKIP: {reason} — {url}`
- Write a minimal TSV to `batch/tracker-additions/{num}-{slug}.tsv` with status `Skip`
- Continue to next entry

### 2c: Full Evaluation (if qualified)

**Note:** Full evaluation generates significant output. Consider whether to:
- Evaluate all entries in sequence (simpler but can be very long)
- Or ask the user how many to evaluate in one run if there are >5 entries

**For rent listings:**
- Follow all steps in `modes/rent.md` Phase 2 (Sections 3–9)
- Write the full report to `reports/`
- Write TSV to `batch/tracker-additions/`

**For buy listings:**
- Follow all steps in `modes/buy.md` Phase 2 (Sections 3–11)
- Write the full report to `reports/`
- Write TSV to `batch/tracker-additions/`

**Note on verification:** In batch mode, set `**Verification:** unconfirmed (batch mode)` in the report header because Playwright liveness checks are not always reliable for queued entries that may have aged.

### 2d: Mark entry as done

After evaluation (qualified or skip):
- Replace `- [ ]` with `- [x]` for that line in `data/pipeline.md`

---

## Step 3: Post-Processing

After all entries are processed:

1. **Run merge-tracker:**
   ```
   node merge-tracker.mjs
   ```
   This merges all newly written TSV files into `data/tracker.md`.

2. **Output summary table:**

```
Pipeline 處理完成 — YYYY-MM-DD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
總共處理: N 個物件
  完整評估: N 個 (報告已生成)
  快篩略過: N 個 (SKIP)
  評估報告: reports/{###}-...

新增至追蹤表:
  + {###} | {district} | {type} | {price} | {score}/5 | {status}
  ...

略過物件:
  - {url} — {reason}
  ...
```

---

## Notes

- **Order matters:** Process entries in the order they appear in pipeline.md (top to bottom).
- **Report numbering:** Each evaluation must check `reports/` for the current highest ### before writing, since earlier entries in the same batch will have incremented the counter.
- **Partial runs:** If the user interrupts mid-batch, already-checked entries (`- [x]`) will not be re-processed on the next run.
- **Error handling:** If a listing URL is unreachable or returns an error, mark it `- [x] ERROR: {reason}` and continue.
