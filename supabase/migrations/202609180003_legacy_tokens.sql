-- Preserve incomplete historical tokens; the application rejects tokens without a UID.
alter table public.password_setup_tokens alter column uid drop not null;
