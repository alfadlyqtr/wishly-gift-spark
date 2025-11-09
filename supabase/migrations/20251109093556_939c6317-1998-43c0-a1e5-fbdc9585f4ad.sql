-- Add date of birth column to user_profiles table
ALTER TABLE public.user_profiles
ADD COLUMN dob DATE;