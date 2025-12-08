-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can update all brands" ON public.brands;
DROP POLICY IF EXISTS "Admins can read all brands" ON public.brands;

-- Allow admin user (admin@tmw.qa) to update brands table
CREATE POLICY "Admins can update all brands" ON public.brands
FOR UPDATE
USING (
  auth.jwt() ->> 'email' = 'admin@tmw.qa'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'admin@tmw.qa'
);

-- Allow admin to read all brands (including private ones)
CREATE POLICY "Admins can read all brands" ON public.brands
FOR SELECT
USING (
  auth.jwt() ->> 'email' = 'admin@tmw.qa'
);
