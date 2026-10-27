# 天道商貿｜發布安全驗收清單（staging only）

狀態：待執行。此文件不是測試通過證明。

## 已辨識的風險
`20261025_exhibition_admin_v1.sql` 的 `exhibition_admin_update_events` RLS 允許 editor/publisher UPDATE，原 `prepare_trade_event()` 僅檢查 publisher 角色即可將資料改成 `published`，未要求郵件意向、MFA、證據摘要與授權審查。

## 暫時阻擋措施
`20261027_exhibition_publication_freeze_draft.sql` 在 `trade_events` 建立 BEFORE trigger：
- INSERT `publication_status='published'` → 拒絕
- UPDATE draft/review/archived → published → 拒絕
- 不改動已存在的 published 紀錄
- 不是最終發布程序；服務角色及資料庫擁有者可管理 schema，需額外控制資料庫管理權限

## 必須在隔離測試專案驗證
1. 匿名、一般登入、editor、publisher 嘗試 INSERT published 均遭拒。
2. editor/publisher 嘗試 UPDATE draft→published 均遭拒。
3. 其他既有 RLS policy 不會造成未授權的公開讀取。
4. 管理員可將資料保存為 draft/review；不可直接發布。
5. 偽造 Gmail From、重放確認碼、過期 challenge、變更證據摘要、未解決 blocker、缺少 MFA 都不得發布。
6. 驗證批次選定的 event IDs 與發布交易逐筆一致。
7. 正式上線前實作後端單一交易程序：驗證管理員、MFA、挑選項目、Gmail 意向、授權與官方證據、最新活動狀態，並記錄 audit。
8. 確認 outbox worker 只讀取已獲核准的通知佇列，服務角色金鑰絕不進入前端。
9. 先執行 TypeScript 測試與 SQL staging integration tests，再進行人工端到端驗收。

## 部署限制
預覽與正式網站目前共用 Supabase；**不得**將此草案直接套用現有正式專案。若未取得獨立 staging 專案及管理者授權，維持只提交 GitHub 開發分支。

## 尚待處理
- 原 migration 對第三方資料來源授權的預設值也需重新審查，不能以設定 `is_authorized=true` 取代實際法務查核。
- 本 freeze 不能代替全面的 RLS、schema 權限與 SECURITY DEFINER 函式稽核。
