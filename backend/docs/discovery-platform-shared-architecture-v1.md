> **2026-10-26 定位修訂：** 本文件早期的「七類獨立探索模組」構想已停止採用。最新產品定義為**商展優先、選擇展覽後顯示站內參展周邊資訊**。不得依本文件舊章節重建獨立食衣住行入口。授權與資料治理請以 [參展周邊資料來源治理 V1](./attendee-data-source-governance-v1.md) 為準。

# 天道商貿｜食衣住行育樂共用骨架 V1（開發分支）
更新：2026-10-26

## 已核對的程式現況
- `b2b/index.html`：B2B 競賽原型首頁，含商品、供應商、詢價導覽。不可改成旅遊首頁或破壞原有路徑。
- `b2b/explore/index.html`：台灣商務探索頁，現有商展搜尋、城市、日期快速篩選。應以此擴充生活探索，不直接刪除商展功能。
- `b2b/admin/exhibitions/admin.js`：展覽後台使用 Supabase REST、登入與權限；來源由 `trade_event_sources` 載入。匯入器現階段仍需修正分類與查核日期寫入。
- `b2b/js/supabase-config.js`：僅公開 publishable key；不得加入 service_role key。
- 現有 `trade_events` 共 313 筆，原有資料不得批次覆寫、刪除或重新分類。

## 模組與共用欄位
| 模組 | 代碼 | 資料類型 | 第一版展示 |
|---|---|---|---|
| 食 | food | 餐廳、咖啡、飲食活動 | 名稱、地點、營業時段、官方連結 |
| 衣 | shopping | 服飾、商圈、商店 | 名稱、品牌/商圈、營業時段、官方連結 |
| 住 | lodging | 飯店、民宿、旅宿 | 名稱、地址、官方連結；價格不假設即時 |
| 行 | transport | 大眾運輸、交通服務 | 路線/服務、營運資訊來源、官方連結 |
| 育 | learning | 課程、講座、教育活動 | 主辦方、時間、地點、報名官方連結 |
| 樂 | leisure | 景點、展演、娛樂活動 | 活動日期、地點、官方連結 |
| 商展 | trade_shows | B2B/B2C 商展 | 保留 trade_events + exhibition_category |

所有模組共用展示欄位：`id`、`module`、`title`、`summary`、`city`、`address`、`official_url`、`source_name`、`source_checked_at`、`status`、`starts_at`、`ends_at`、`updated_at`。這是**前端資料契約**，不代表生產資料庫已存在同名欄位。

## 後端設計：避免破壞既有展覽表
1. 保留 `trade_events`、`trade_event_sources`、RLS、trigger、已發布資料不動。
2. 新建生活探索資料表（建議 `discovery_places`、`discovery_activities`、`discovery_sources`、`discovery_sync_runs`）；先在隔離環境驗證 schema、RLS、唯一鍵與去重策略。
3. 以唯讀 API adapter 將商展和新資料轉成共用展示欄位；不要直接把住宿/餐廳塞進 `trade_events`。
4. 匯入流程：合法資料來源 → 擷取/欄位驗證 → canonical key 去重 → draft → 人工審核 → published；來源失效標記待查，不自動刪除。
5. 資料來源類型標記 `api` / `open_data` / `official_page` / `manual`；`official_page` 不等於已取得自動爬取許可。
6. 每個模組可獨立設定同步頻率、失敗重試、來源最後檢查時間、審核策略；沒有授權或穩定 API 的來源先用人工匯入。

## 前端最小改動
1. 保留 `/b2b/` 原有 B2B 入口、商品、供應商與詢價。
2. 在 `/b2b/explore/` 增加模組切換「全部／食／衣／住／行／育／樂／商展」。
3. 共用搜尋框、縣市、日期、官方連結；模組專屬篩選器按需顯示，避免住宿與交通誤用商展日期欄位。
4. 無資料時明確顯示「尚未接入來源」，不能用示範資料偽裝真實店家或活動。
5. 明確標示只提供資訊、建議、時段與外部連結；不代訂票、訂房、付款。

## 實作順序與驗收
**A. 共用導覽**：先完成前端模組切換與空狀態；驗證商展搜尋仍可用，原有路徑不變。
**B. 生活資料 schema**：測試環境部署與 RLS 測試，確認不影響 `trade_events`。
**C. 第一個生活資料來源**：選有明確再利用條款的官方 API，從來源到草稿到發布完整跑通。
**D. 來源擴充**：食、衣、住、行、育、樂逐一接入，依資料品質和授權決定是否自動同步。
**E. 展覽同步**：先修正現有 CSV 匯入器分類欄位與查核日期，再接合法來源排程。

## 發布安全規則
- 所有修改僅限 `codex/exhibition-admin-v1`，未經明確同意不合併 GitHub `main`。
- Cloudflare Pages 預覽環境仍連生產 Supabase：測試前端時不得用真實資料庫做未確認的批次寫入。
- 不直接執行 `backend/migrations/20261025_exhibition_admin_v1.sql`。
- 不儲存或公開 service_role key、API 私鑰、登入密碼。
- 自動化排程要部署後才能稱為已啟用；建立設計文件不等於自動同步已運作。
