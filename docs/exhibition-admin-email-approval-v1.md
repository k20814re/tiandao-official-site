# 天道商貿｜異常通知與管理員雙重確認發布規格 v1

狀態：設計規格；尚未啟用寄信、收信或正式發布。不得直接套用正式 Supabase。

## 流程
1. 合法來源匯入候選展覽 → 比對官方證據、授權、日期、場館、票價、時段、異動、重複。
2. 異常／缺證據 → quarantined，不公開；產生事件及證據快照。
3. 寄「異常審核通知」到已驗證的管理員信箱。信件含摘要、異常類別、來源連結、審核批次 ID、後台安全登入連結；不得夾帶可直接發布的秘密 token。
4. 管理員登入後台勾選每筆候選，選擇核准／退回／重新查證；保留操作者、理由與證據版本。
5. 後端寄「最終發布確認」信，列出已勾選筆數、每筆差異及批次摘要。
6. 管理員透過已驗證登入狀態的確認頁確認；回覆郵件可以是意向通知，但**不得**單憑郵件內容或寄件者地址觸發發布。
7. 後端驗證一次性 challenge（短效、綁定管理員、批次、候選版本 hash）、role=publisher、資料來源合法性與所有必要欄位；全部通過後以交易方式發布。
8. 發布後寄結果回執；有失敗者維持 review/quarantined，不可部分靜默成功。

## 異常等級
- BLOCKER：授權不明／禁止利用、官方資料衝突、官方頁無法追溯、活動取消、偽冒來源、資料版本變更；不得核准直接發布，須先修正證據或取得合法使用依據。
- REVIEW：缺少票價、開放時間、地點細節或疑似重複；管理員可決定暫緩或以「待確認」發布非關鍵欄位，但名稱、展期、城市、場館、合法來源必須核實。
- INFO：非關鍵文字或格式差異，可批次審核。

## 審核資料模型（建議新表）
- exhibition_review_batches: id, status, created_at, created_by, reviewer_id, reviewer_email, expires_at, evidence_digest, sent_at, confirmed_at
- exhibition_review_items: id, batch_id, event_id, candidate_payload, source_url, license_status, fact_status, severity, anomaly_codes, decision, decision_reason, reviewed_at, evidence_digest
- exhibition_review_challenges: id, batch_id, reviewer_id, challenge_hash, expires_at, used_at, digest, attempt_count
- exhibition_audit_log: id, actor_id, action, batch_id, event_id, before_state, after_state, occurred_at, metadata
- notification_outbox: id, type, recipient, batch_id, idempotency_key, status, attempts, last_error, created_at, sent_at

## 安全與法務
- 來源許可 allowlist；網站條款與授權條款審核；遵守資料取得限制；不擅自重製受保護的圖片、海報、LOGO 或長篇文案。
- 管理員勾選不會凌駕 BLOCKER；法律風險必須先解除。
- RLS、後端 service-role、管理員驗證、寄信 webhook 簽章驗證、CSRF／重放防護、限流、稽核紀錄。
- 不得把 Supabase service_role、SMTP/API secret 放在 GitHub Pages 前端。
- 收信解析若未來啟用，必須使用驗證過的 inbound webhook；不得僅依 From、主旨或「同意」文字批准。
- 檔期異動須重新產生證據 hash；舊的核准與 challenge 立即失效。
- 無寄信供應商與管理員信箱時，不得假稱已寄出。

## MVP 驗收
- 1 筆 BLOCKER 無法發布，即使管理員勾選。
- 1 筆 REVIEW 可由管理員審核，必要事實及合法性仍必須通過。
- 逾時、重複點擊、偽造回信、不同管理員、候選被修改時，發布均失敗。
- 批次確認成功後只發布被勾選且通過檢查的項目；其餘保留審核狀態。
- 通知失敗可重試，且不得重複寄送或重複發布。

## 待使用者確認
管理員收件信箱：k20814re@gmail.com（使用者指定；尚未驗證信箱所有權）；寄信服務（例如 Resend／SendGrid）、是否要真正「回覆郵件」還是「信中安全確認連結」。
建議 MVP 使用安全確認連結，並保留登入驗證。
