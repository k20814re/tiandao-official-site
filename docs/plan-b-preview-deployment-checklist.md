# Plan B preview deployment contract

This page is a **draft review aid**, not an admin authorization boundary or public exhibition feed.

## Paths
- UI: `/b2b/explore/review-preview.html`
- Automatic manifest request on the dedicated preview host only: `/backend/review/plan-b-first-batch-candidates.json`
- The request succeeds **only if** the Cloudflare Pages output directory actually contains that file at this path. Repository presence alone does not imply deployment.
- On missing or invalid manifest, use the local JSON file picker and the offline generator. Do not copy the backend directory into production merely to make the preview work.

## Verification before claiming success
1. Run `bash backend/review/run-unit-tests.sh` with Node 22 or later; all scripts must pass.
2. Verify the preview host's HTML is deployed from `codex/exhibition-admin-v1`.
3. Check the browser Network tab: manifest request returns HTTP 200 with JSON, not a SPA fallback HTML or 404.
4. Confirm exactly ten draft cards, ten blocked candidates and zero publishable.
5. Confirm `https://tiandaoonline.com/b2b/explore/` still uses only its approved published-data query.
6. Confirm no draft data was written to Supabase, no `main` merge occurred, and no preview access control is implied by the hostname check.

## Privacy and security
The preview hostname is not an access-control mechanism. The current automatic JSON fetch may expose review source material if that path is publicly deployed. Restrict preview access at the hosting layer before exposing internal notes, personal information, or unreleased material. Do not deploy the complete `backend/review` directory to production.

## Publication
No review flag in this page can approve a record. Server-side authorization, licensing and independent source verification are separate requirements.
