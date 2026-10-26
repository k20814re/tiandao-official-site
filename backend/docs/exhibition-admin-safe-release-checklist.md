# 天道商貿｜商展後台安全上線檢查（2026-10-26）

## 不可直接執行的舊 migration

**不要在既有 Supabase 專案直接執行** `backend/migrations/20261025_exhibition_admin_v1.sql`。
該檔案包含 `review` 狀態、替換觸發函數、刪除重建 RLS 政策，以及來源資料 upsert，可能與正式環境的 `draft/published/archived` 限制衝突。它不是無副作用的增量遷移。

## 正式資料庫檢查（不修改資料）

1. 在 Supabase SQL Editor 執行 `backend/sql/trade_show_preflight_readonly.sql`。
2. 執行 `backend/sql/trade_show_canonical_key_audit_readonly.sql`。
3. 確認 `canonical_key` 有唯一索引或唯一約束，且非 NULL 值無重複。
4. 確認現有 `publication_status` 值與 CHECK 約束，並保留現有 `sync-taipei-events`、`sync-culture-exhibitions` 及全部資料。
5. 檢查 RLS、trigger 與 `trade_event_sources` 實際欄位，**不得**假設舊 migration 可套用。

## 測試資料庫的執行順序

1. 備份測試環境，確認 schema 與正式環境相同。
2. 在測試環境執行 **僅新增欄位** 的 `backend/migrations/20261026_trade_show_category_v1.sql`。
3. 驗證 `exhibition_category`、`source_checked_at` 欄位與 CHECK 約束。
4. 測試後台登入、來源載入、展覽載入、分類篩選、建立草稿、修改草稿、人工發布權限與封存。
5. 使用相同 CSV 重複匯入、同時匯入，確認不覆蓋已發布資料。PostgREST `on_conflict=canonical_key` 必須搭配有效唯一索引；不能只靠前端去重。
6. 測試 Edge Functions 仍可同步，且不會變更人工審核分類或發布狀態。
7. 確認公開探索頁仍只展示符合公開政策的資料，並確認既有展覽資料筆數與狀態未意外改變。

## 上線門檻

尚未取得上述實測結果之前，**不得**合併 `main`、不得執行正式環境 migration，也不得聲稱已部署或完成整合測試。

## 已知限制

- 後台目前最多載入 1000 筆，尚未完成分頁。
- `source_checked_at` 為人工填寫，並非自動查核官方來源。
- 關鍵字「商展候選」只是初篩，不等同人工確認的 `exhibition_category`。
- 舊資料分類維持 NULL（未分類）。
