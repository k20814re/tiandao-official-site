# 臺灣商展資料匯入 V1（人工審核優先）

## 原則
- 只使用官方公開資訊作為核對依據；未確認授權前，不自動爬取官方商展網站。
- 不影響既有臺北旅遊網、文化部同步流程及資料。
- 商展資料一律先存 `draft`，經管理者確認後才發布。
- 分類：`b2b_trade_show`（專業商展）、`b2c_consumer_fair`（消費展售）、`arts_exhibition`（藝文展）、`other_event`（一般活動）。
- 匯入來源須保存官方網址與查核日期；不推測未公布的開放時間、票價。
- 若要自動同步，需另行確認來源 API 或資料再利用授權。

## 首批來源
- 臺灣國際專業展：https://www.taiwantradeshows.com.tw/
- 外貿協會：https://www.taitra.org.tw/
- 各展館及主辦單位官網（逐筆人工核對）

## CSV 欄位
見 `b2b/admin/exhibitions/templates/taiwan-tradeshows.csv`。
必填：`title_zh`、`starts_at`、`ends_at`。日期建議用含時區的 ISO 8601，例如 `2027-03-10T10:00:00+08:00`；若只有日期、未確認開放時間，不應捏造時刻，需先人工查證再匯入。
`exhibition_category` 和 `source_checked_at` 是匯入前資料治理欄位；目前舊後台匯入器尚未將其寫入資料庫，不能假裝已支援。

## 上線前必要修正
1. 現有 `admin.js` 使用 `on_conflict=source_id,dedupe_key`，須核對資料庫唯一索引及觸發器，避免重複或失敗。
2. 生產環境 `publication_status` 只接受 `draft`、`published`、`archived`；既有 migration 的 `review` 定義與實際資料庫不一致。不要直接重跑整份舊 migration。
3. 在確認 `trade_events` 分類欄位與約束前，不直接寫入 `exhibition_category`，避免造成匯入失敗。
4. 正式發布前，確認官方資料使用條款及網址可用性。

## 狀態
這是可供管理者準備資料的第一版範本與實作規格；尚未建立自動同步 Edge Function，也尚未部署到 main 或 Supabase。
