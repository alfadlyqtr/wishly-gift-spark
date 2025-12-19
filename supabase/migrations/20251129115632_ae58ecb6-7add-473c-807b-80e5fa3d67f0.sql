-- Fix the handle_new_user trigger to use correct table name
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create profile for non-business accounts
  IF COALESCE(NEW.raw_user_meta_data->>'account_type', 'user') != 'business' THEN
    INSERT INTO public.user_profiles (id, username, full_name, email, dob, country)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', ''),
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.email,
      (NEW.raw_user_meta_data->>'dob')::date,
      COALESCE(NEW.raw_user_meta_data->>'country', '')
    );
  END IF;
  RETURN NEW;
END;
$$;
-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
