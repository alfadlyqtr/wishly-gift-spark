-- Add 'thank_you_card' to the allowed attachment_type values
ALTER TABLE public.messages DROP CONSTRAINT messages_attachment_type_check;

ALTER TABLE public.messages ADD CONSTRAINT messages_attachment_type_check 
  CHECK (attachment_type = ANY (ARRAY['image'::text, 'audio'::text, 'thank_you_card'::text]));;
