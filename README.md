# tw-house-ops

台灣看房 AI 管線，建構於 Claude Code 之上。自動化物件發掘、評估與追蹤，涵蓋租屋與購屋市場的完整搜尋流程。

---

## 功能概覽

- **掃描** 591、樂屋網、信義、永慶、東森、住商，搜尋符合條件的新物件
- **評估** 每間物件：與市場行情（實價登錄）比較、通勤計算、五維度評分
- **追蹤** 所有考慮過的物件，以結構化 Markdown 表格記錄
- **試算** 可負擔房價（首購族）與換屋財務規劃（換屋族）
- **準備** 根據評估報告產生看屋清單與議價策略

支援三種使用者類型：**租屋族**、**首購族**、**換屋族**。

---

## 事前準備

掃描（`scan`）與物件上架驗證依賴 `agent-browser`，**使用前必須安裝**：

```bash
npm install -g agent-browser
```

確認安裝成功：

```bash
agent-browser --version
```

> 未安裝的情況下執行 `scan` 或貼上 URL，Claude 將無法爬取真實頁面內容，後續評估結果不可信。Claude Code 每次啟動時會自動偵測並提示。

---

## 快速開始

1. 安裝 `agent-browser`（見上方）
2. Clone 此 repo 並在 Claude Code 中開啟
3. Claude 會自動偵測缺少的設定檔，啟動初始設定流程（7 個步驟，約 5 分鐘）
4. 設定完成後，貼上任何物件 URL 即可評估——或輸入 `scan` 搜尋目標區域

---

## 用法

| 輸入 | 動作 |
|------|------|
| 貼上物件 URL | 自動判斷租屋 / 買屋 → 評估 → 產生報告 |
| `scan` | 在目標區域掃描各平台的新物件 |
| `pipeline` | 批次處理 `data/pipeline.md` 中所有待評估 URL |
| `compare 001, 003` | 並列比較兩間已評估物件 |
| `prepare visit for 001` | 產生報告 001 的看屋清單與議價策略 |
| `affordability` | 試算可負擔房價與區域適配（首購族） |
| `upgrade plan` | 換屋財務規劃：賣舊屋 + 買新房時程與資金缺口分析（換屋族） |
| `tracker` | 顯示所有追蹤物件的摘要 |

---

## 目錄結構

```
tw-house-ops/
├── CLAUDE.md                    # 入口：模式路由、初始設定、資料合約
├── config/
│   ├── profile.yml              # 個人設定（永遠不會被系統更新覆寫）
│   └── profile.example.yml      # 設定範本
├── portals.yml                  # 各平台 URL 與掃描設定
├── modes/
│   ├── _shared.md               # 評分維度、台灣市場知識
│   ├── _profile.md              # 個人情境（每次評估都會注入）
│   ├── _profile.template.md     # _profile.md 的初始範本
│   ├── scan.md                  # 平台掃描器
│   ├── rent.md                  # 租屋評估
│   ├── buy.md                   # 購屋評估
│   ├── afford.md                # 可負擔房價試算
│   ├── switch.md                # 換屋規劃
│   ├── compare.md               # 多物件比較
│   ├── visit.md                 # 看屋清單與看後記錄
│   └── pipeline.md              # 批次評估處理器
├── data/
│   ├── pipeline.md              # 待評估 URL 收件匣
│   ├── tracker.md               # 物件追蹤主表
│   └── scan-history.tsv         # 去重紀錄（已加入 .gitignore）
├── reports/                     # 各物件評估報告
├── batch/tracker-additions/     # 待合併 TSV 暫存
├── templates/states.yml         # 追蹤表狀態標準值
├── merge-tracker.mjs            # 合併 TSV 至 tracker.md
├── verify-pipeline.mjs          # 驗證 pipeline 完整性
└── dedup-tracker.mjs            # 移除重複的追蹤條目
```

---

## 評分標準

物件依五個維度評分 0–5：

| 維度 | 租屋權重 | 買屋權重 |
|------|----------|----------|
| 價格合理性 | 30% | 35% |
| 空間與格局 | 20% | 20% |
| 區域生活機能 | 25% | 20% |
| 物件條件 | 15% | 15% |
| 風險與潛力 | 10% | 10% |

分數判讀：≥4.0 → 推薦看屋　·　3.5–3.9 → 持保留態度　·　<3.5 → 建議跳過

---

## 追蹤表狀態

`Scanned` → `Evaluated` → `Visit` → `Visited` → `Offer` → `Negotiating` → `Signed` → `Done`

另有：`Skip`（篩除）、`Pass`（看後放棄）、`Expired`（物件已下架）

---

## 資料合約

**使用者層**（永遠不會被自動覆寫）：`config/profile.yml`、`modes/_profile.md`、`data/*`、`reports/*`

**系統層**（可能隨系統更新）：所有 mode 檔案、`CLAUDE.md`、`*.mjs` 腳本、`templates/*`

---

## 腳本

```bash
node merge-tracker.mjs           # 合併待新增 TSV 至 tracker.md
node verify-pipeline.mjs         # 檢查 pipeline 完整性
node dedup-tracker.mjs           # 移除重複追蹤條目
node --test tests/**/*.test.mjs  # 執行所有測試
```

---

## 使用原則

本系統以精準找房為目標，非大量瀏覽。Claude 不會代替你送出 offer、簽約或送出任何申請。評分低於 3.5/5 的物件將被明確建議不值得追蹤。
