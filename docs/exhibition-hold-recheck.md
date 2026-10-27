# Gmail hold and fresh verification

Two exact first-line commands are accepted from the verified owner's SENT reply in the original notification thread:
- `整批保留`: preserve the full existing record and keep an unconditional hold.
- `整批保留，查核通過後發布` (ASCII comma also accepted): hold now and request a new analysis; publication still requires at least 80 points and every mandatory gate.

The connected Gmail task must verify account, sender, recipient, SENT labels, MIME plain text, reply/reference headers, timestamps, one matching subject batch tag, and the original notification identity before calling the private invoker-only `exhibition_automation.record_reply` function. Email identity is verified by Gmail tools; database parameters are not independent proof of Gmail identity. The function is not callable by anon, authenticated, or service_role. It validates the entire sent queue batch and records a receipt atomically.

A reply never publishes directly. A newer explicit verified command may change a prior hold's intent; ambiguous replies do nothing. Existing holds migrate as unconditional holds. Replayed message IDs have no effect, and older decisions cannot replace newer ones.

The next eligible hourly analysis re-fetches the official list and detail. A hold may release only within the same transaction that publishes a valid candidate. The analysis must have started after the intent was recorded, its evidence must be fresh, and its optimistic version check must still pass. Failures, stale evidence, mismatched required fields, dry runs and publication exceptions retain the hold. Publication and release are audited by analysis run ID and reply message ID.

Recheck requests clear only the automation's last_checked_at to make the existing worker consider them. Changed source data is checked by the normal hourly worker; unchanged failed data is revisited under its existing daily recheck policy. No new scheduler, paid service, source ingestion or archive enablement is introduced.

Manual holds also block source-removal archiving even if that setting is enabled later. Automatic archiving remains disabled. Thresholds and source authorization requirements are unchanged.

Validation: pure Gmail policy tests plus disposable PostgreSQL 17 transaction and two-session duplicate-delivery tests. Production deployment must verify function definitions, ACLs, settings, unchanged existing locks and a new real analysis run. No synthetic Gmail reply is sent as though it were the user's command.

## Deployment verification — 2026-10-27 (Asia/Taipei)

- Applied production migration `exhibition_mail_hold_receipts` to project `ibvmfmgikraatiobpmmz`.
- Updated the existing Gmail review task to call the private receipt function after Gmail identity/thread/plain-text/batch checks. Schedule unchanged.
- PostgreSQL 17 transaction/concurrency and Node policy jobs both passed at commit `26b75648da6dccd125104fd4d6b89f0961b9e8b7`:
  https://github.com/k20814re/tiandao-official-site/actions/runs/40519252377
- Triggered the existing analyzer once. The 22:18:50–22:18:53 production run succeeded with 20 published/upsert decisions and zero errors. All 20 present-evidence records carried the new review-intent audit fields; these are not a count of newly created exhibitions.
- Verified all 23 original batch holds remain active and unconditional. Zero holds were released. No eligible new owner reply was available, so no real reply was falsely claimed as processed.
- Enabled analysis/publication remained true, threshold remained 80, archive_changes remained false, pending mail remained zero. The existing hourly cron remained enabled.
- The connector can execute the private recorder; anon/authenticated/service_role cannot. Public callers also cannot call the publication RPC. Existing unrelated security advisor notices were unchanged.
- Verification covers isolated valid/invalid reply scenarios plus the deployed analyzer and task configuration. The first real eligible owner reply still has to arrive through Gmail.
