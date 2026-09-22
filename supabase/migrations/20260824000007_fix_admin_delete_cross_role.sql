-- Fix is_admin_or_gm function to allow all admin emails and roles
CREATE OR REPLACE FUNCTION public.is_admin_or_gm()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $func$
  SELECT (
    (COALESCE(auth.jwt() ->> 'email', '')) IN (
      'lucas@soltheory.com',
      'steve@soltheory.com',
      'gerard@soltheory.com',
      'lucashu42@proton.me',
      'lukehuff90@gmail.com',
      'team@soltheory.com'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role IN ('admin', 'game_master') OR is_admin = true)
    )
  );
$func$;

-- Update all admin user profiles
UPDATE public.profiles
SET is_admin = true, role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'lucas@soltheory.com',
    'steve@soltheory.com',
    'gerard@soltheory.com',
    'lucashu42@proton.me',
    'lukehuff90@gmail.com',
    'team@soltheory.com'
  )
);
