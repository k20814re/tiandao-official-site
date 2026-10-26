# Plan B — first ten exhibition candidates: manifest audit

Audit date: 2026-10-27. Source: `backend/review/plan-b-first-batch-candidates.json` on `codex/exhibition-admin-v1`.

This report is a deterministic manifest-field inspection, **not** a live website check, successful execution of the Node.js audit CLI, authorization to reuse copyrighted materials, or permission to publish.

| # | Exhibition | Blockers / incomplete fields |
|---|---|---|
| 1 | 2026 ITF台灣國際旅展 | E011, E005, E010 |
| 2 | 2026 臺灣國際咖啡展 | E011, E005, E010 |
| 3 | 2026台北國際建築建材暨產品展 | E011, E005, E010 |
| 4 | 2026臺灣茶業博覽會 | E011, E005, E010; opening hours |
| 5 | 2026臺灣國際食品暨設備展 | E011, E005, E010; opening hours |
| 6 | 2026台灣醫療科技展 | E011, E005, E010; opening hours |
| 7 | 2026展昭台北國際酒展 | E011, E005, E010, E001; opening hours |
| 8 | 2026高雄漾藝術博覽會 | E011, E005, E010; detailed address |
| 9 | 2026高雄國際冬季旅展 | E011, E005, E010; detailed address, opening hours |
| 10 | 2026展昭高雄寵物用品展-獨霸場 | E011, E005, E010, E001; detailed address |

Totals: 10/10 missing `source_checked_at`; 10/10 `source_license_cleared=false`; 10/10 `facts_verified=false`; 2 generic official URLs; 3 addresses not confirmed; 5 hours not confirmed. A single record may have multiple blockers.

## Suggested order

1. Recheck official sources for ITF, Coffee Show and Taipei Building Show, record actual source-check UTC timestamp per event and verify all facts.
2. For tea, food, healthcare, Kaohsiung art, and winter travel events, fill missing address/hours with direct event evidence.
3. Replace generic wine and pet show URLs with dedicated organizer or venue event-specific pages.
4. Review rights to reuse source text and imagery. Original factual summaries with official outbound links are preferable to copying descriptions or images.
5. Run the complete CLI audit and tests in a suitable Node environment. Do not import to the live Supabase or publish without an approved trusted backend and RLS acceptance.

No changes to production, `main`, or Supabase are authorized by this report.
