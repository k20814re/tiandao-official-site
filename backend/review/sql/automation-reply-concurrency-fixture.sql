-- CI-only two-session duplicate reply fixture.
insert into exhibition_automation.mail_queue(dedupe_key,canonical_key,title,score,reason,evidence,status,gmail_message_id,created_at,sent_at)
values('receipt-concurrent','moc:receipt-concurrent','Concurrent',40,'CI','{}','sent','aa90',now()-interval '5 minutes',now()-interval '5 minutes');
