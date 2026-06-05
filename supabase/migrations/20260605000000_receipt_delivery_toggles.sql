-- Per-merchant toggles for receipt delivery channels.
-- Email: real (Resend) when RESEND_API_KEY is configured.
-- Print: cloud-dispatch path exists in packages/printing; requires a printer registered.
-- SMS: toggle reserved for future Twilio integration; delivery not wired yet.
alter table public.merchant_features add column if not exists email_receipts boolean not null default true;
alter table public.merchant_features add column if not exists print_receipts boolean not null default true;
alter table public.merchant_features add column if not exists sms_receipts boolean not null default false;
