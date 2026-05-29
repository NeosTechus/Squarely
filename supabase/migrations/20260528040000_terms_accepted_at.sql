-- Record when a merchant accepted the Terms of Service / Privacy Policy.
-- Set at self-serve signup (owner checks the box) and at super-admin onboarding.
alter table merchants add column if not exists terms_accepted_at timestamptz;
