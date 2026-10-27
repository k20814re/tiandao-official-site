select exhibition_automation.record_reply('aa90','bb90','aa90',
'td-review-'||md5(string_agg(id::text,',' order by id)),min(created_at)+interval '1 second',
'整批保留，查核通過後發布','k20814re@gmail.com')
from exhibition_automation.mail_queue where gmail_message_id='aa90' and status='sent';
