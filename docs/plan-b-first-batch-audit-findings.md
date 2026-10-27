# Plan B first batch — audit findings (2026-10-27)

Scope: `backend/review/plan-b-first-batch-candidates.json` (10 research leads, not published records).

## Confirmed schema blocker

Every candidate in the manifest lacks `source_checked_at`. The current `checkManualCandidate` requires a valid, non-future timestamp. Consequently **all 10 fail E011:source_check_missing**, irrespective of other fields. Never invent a timestamp from the manifest's `reviewed_on` date: that date does not establish per-event evidence checks.

All 10 also explicitly set `source_license_cleared: false` and `facts_verified: false`, so **all 10 fail E005 and E010**. These booleans are not approvals; they may only be changed after actual independent review.

## Additional URL blockers

- 2026 Taipei International Wine Show: hall-filtered event list `https://www.tainex.com.tw/event?hall=2` is not a dedicated event page, even though the current pathname-only gate may mistakenly accept it.
- 2026 Kaohsiung Pet Supplies Show: organizer homepage `https://www.chanchao.com.tw/` is not a dedicated event page.
- 2026 Kaohsiung Young Art Fair: `https://yak.khcc.gov.tw/tw` is a microsite entry; review whether it is event-specific rather than blindly accepting/rejecting its path.

## Next safe acceptance steps

1. Open and recheck the official event-specific source for each record; independently verify event name, date, venue, hours and admission, then record the actual UTC `source_checked_at` time.
2. Replace directory/homepage links with specific official event pages; treat generic calendars as corroboration, not primary event evidence.
3. Confirm reuse/license for text, logos and images separately; prefer original factual summaries and no third-party imagery until cleared.
4. Run `node --experimental-strip-types backend/review/audit-plan-b-candidates.ts` and inspect each blocker. A passing client-side/preliminary audit is **not** publication authorization.
5. Test a **separate** staging Supabase project with draft-only import; verify RLS and trusted server-side publication before any production changes.

## Production safety

Do not import these leads to production or publish them, do not apply draft migrations to the shared live Supabase, and do not merge the development branch to `main` without approval.
