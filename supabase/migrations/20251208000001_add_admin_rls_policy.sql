-- Allow admin user (admin@tmw.qa) to update suspension fields in user_profiles
CREATE POLICY "Admins can update user suspension status" ON public.user_profiles
FOR UPDATE
USING (
  auth.jwt() ->> 'email' = 'admin@tmw.qa'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'admin@tmw.qa'
);

-- Allow admin to read all user profiles
CREATE POLICY "Admins can read all user profiles" ON public.user_profiles
FOR SELECT
USING (
  auth.jwt() ->> 'email' = 'admin@tmw.qa'
);
