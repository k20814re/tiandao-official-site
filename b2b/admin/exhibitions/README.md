# Exhibition admin V1

Public path: /b2b/admin/exhibitions/

## Included

- Supabase email/password login using the existing publishable key only.
- Editor and publisher roles enforced by RLS and a database trigger.
- Manual create/edit/archive and draft → review → published workflow.
- CSV/XLSX browser import; imports always begin as drafts.
- API, file, and manually curated public-web source registry.
- Translations JSON, ISO country/currency codes, and IANA timezone fields.
- Source + external ID dedupe, with SHA-256 content fingerprint fallback.
- The existing explore page still requests only published, non-deleted rows.

## Required Supabase setup

1. Back up the project or create a Supabase branch.
2. Review and run backend/migrations/20261025_exhibition_admin_v1.sql.
3. In Authentication, invite the staff user. Never put a secret or service-role key in GitHub.
4. Copy the Auth user UUID and run the commented bootstrap insert at the bottom of the migration.
5. Confirm the 293 Ministry of Culture records remain present and published.
6. Run the verification queries below.

    select publication_status,count(*) from public.trade_events where deleted_at is null group by 1;
    select code,name,source_type,is_active from public.trade_event_sources order by name;
    select * from public.exhibition_admin_profiles;

Audit all policies before production:

    select schemaname,tablename,policyname,roles,cmd,qual,with_check
    from pg_policies
    where schemaname='public'
      and tablename in ('trade_events','trade_event_sources','exhibition_admin_profiles')
    order by tablename,policyname;

There must be no anonymous policy that can read draft or review rows. Production was previously verified to expose published rows only. This migration adds named V1 policies without deleting unknown legacy policies.

## Source policy

Before importing a public web page, record its URL, checked date, and permission/terms assessment. BOFT, TAITRA, MEET TAIWAN, venue, and organizer placeholders are inactive by default. Activate each only after its acquisition method is reviewed. Secret-bearing API work belongs in a server or Supabase Edge Function, never this browser admin.
## Taipei Travel Open API sync

The first additional live source is the official Taipei Travel Activity API:

- Endpoint: https://www.travel.taipei/open-api/zh-tw/Events/Activity
- Authentication: none.
- License: Government Data Open License, version 1.
- Import behavior: new records enter review status; existing workflow status is preserved.
- Opening-hour text found only inside descriptions is stored as raw, needs-review data. It is never guessed.
- The Edge Function accepts a signed-in publisher, or a scheduler request carrying TAIPEI_SYNC_SECRET.

Deploy after the migration:

    supabase functions deploy sync-taipei-events --no-verify-jwt
    supabase secrets set TAIPEI_SYNC_SECRET=GENERATE_A_LONG_RANDOM_VALUE

Do not set SUPABASE_SERVICE_ROLE_KEY in browser code. Supabase provides it only inside the deployed Edge Function environment. For scheduled execution, store the sync secret in Supabase Vault and send it as x-sync-secret from pg_cron/pg_net. Test one manual publisher sync before enabling a daily schedule.

The admin button named 同步臺北旅遊網 invokes the function. Imported rows are not visible on /b2b/explore/ until a publisher reviews and publishes them.

