# 天道商貿｜目前架構與接續狀態

更新：2026-10-27（台灣時間）

## 已確定的產品需求

- 國貿展覽資訊為主軸；選擇展覽後在站內顯示參展資訊及當地食衣住行、玩樂與時段參考。
- 保留使用者選擇的資訊供整理；只提供資訊，不代訂、不收款。
- 多來源：官方 API、開放資料、CSV/XLSX、人工整理；需來源註記、授權判定、去重與審核。
- 正式站保留既有功能與 Cloudflare Web Analytics。
- 需要一眼能了解前台、後台、資料庫、API、流量與開發進度的總覽。
- 完整自動化 B 方案仍須通過驗證才能發布。

## 架構與證據

| 層 | 位置 | 目前狀態 |
|---|---|---|
| 展覽前台 | b2b/explore/ | 已有公開資料查詢、分頁及匯出；開發分支離線測試通過，非正式版驗收 |
| 管理後台 | b2b/admin/exhibitions/ | 已有管理介面；真實登入、權限與匯入需整合驗證 |
| 資料庫 | Supabase trade_events / trade_event_sources | 保留正式資料；本次沒有執行 migration 或寫入資料 |
| 同步入口 | supabase/functions/sync-taipei-events/ | 已有程式；本次未驗證正式部署與同步結果 |
| 郵件審核 | backend/review/gmail-*.ts | OAuth、解析、一次性授權、MFA 邊界與協調器有模擬測試；尚不是完整部署的 HTTP 服務 |
| 發信 | Resend notifier / smoke function | 已有程式與測試；本次沒有發信 |
| 流量 | Cloudflare Web Analytics | 歷史紀錄確認已安裝；本次未查詢即時統計 |
| 開發驗證 | .github/workflows/exhibition-review-checks.yml | commit 12d2805 的 Actions run 40461992116 成功 |

## 本次完成

修正 affiliate-static.test.ts 的 DOM 測試路徑：ul → li → a。原測試讀取 li 的 rel/target，導致 CI 失敗；不需修改實際連結程式。

執行完整 run-unit-tests.sh，全部完成。包含 Gmail 模擬流程、SQL 靜態檢查、501/10000/10001 筆分頁與 CSV/ICS 匯出。10001 筆案例預期顯示超量錯誤後通過，並非測試失敗。

## 尚未完成，不得標為已上線

1. 真實 Supabase 管理登入、schema/RLS 唯讀稽核及隔離 staging 交易驗證。
2. 真實 Gmail OAuth、refresh token 安全保存、服務端入口與排程整合。
3. 實際通知寄送與端到端回信審核；不得把 Gmail 連接器可讀信視為網站已取得 OAuth。
4. 首批官方展覽逐筆查核與來源使用條款確認。現有十筆候選仍全部阻擋，不能改旗標當成查核。
5. 前台手機/桌面與站內參展面板的真實瀏覽器驗收。
6. 通過上述驗證後處理 PR #3 合併條件與正式部署；本次沒有合併 main。

## 目前接續阻塞

本次瀏覽器開啟 Supabase dashboard 後導向登入畫面，沒有可沿用的管理工作階段。需要安全登入後才能繼續查明真實專案與隔離測試環境。權限授權不等於已存在登入工作階段；不得要求在聊天貼密碼或私鑰。
