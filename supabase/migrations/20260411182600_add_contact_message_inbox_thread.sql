alter table public.contact_messages
add column if not exists inbox_thread_id uuid references public.threads(id) on delete set null;
