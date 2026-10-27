insert into public.exhibition_gmail_review_challenges(review_id,challenge_sha256,expected_admin_id,evidence_sha256,expires_at)
values('concurrent-review',repeat('a',64),'00000000-0000-4000-8000-000000000001',repeat('b',64),now()+interval '1 hour');
insert into public.exhibition_review_authorizations(authorization_id,review_id,admin_id,mfa_verified_at,authenticated_at,expires_at)
values('00000000-0000-4000-8000-000000000005','concurrent-review','00000000-0000-4000-8000-000000000001',now(),now(),now()+interval '1 hour');
