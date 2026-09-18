-- Historical abandoned signups can have no email. Checkout validates email before use.
alter table public.pending_signups alter column email drop not null;
