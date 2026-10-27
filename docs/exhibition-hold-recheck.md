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
