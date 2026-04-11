alter table public.contact_messages
add column if not exists admin_reply text,
add column if not exists replied_at timestamp with time zone,
add column if not exists replied_by uuid;
