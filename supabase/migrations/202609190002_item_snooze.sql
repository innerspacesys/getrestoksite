-- Restok: per-item snooze — "remind me again later" without marking a supply
-- restocked (which would corrupt the learned-restock-interval history).
begin;
alter table public.items
  add column if not exists snoozed_until timestamptz;
commit;
