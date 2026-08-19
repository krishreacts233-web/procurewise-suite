-- 1) Restrict who can execute SECURITY DEFINER / trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.my_vendor_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vendor_id() TO authenticated, service_role;

-- 2) Allow a signed-in user to submit their own approval request (Pending only)
DROP POLICY IF EXISTS "approval self insert" ON public.account_approval_requests;
CREATE POLICY "approval self insert"
ON public.account_approval_requests
FOR INSERT
TO authenticated
WITH CHECK (
  "userId" = auth.uid()
  AND status = 'Pending'
  AND approved_by IS NULL
  AND approved_date IS NULL
  AND rejected_by IS NULL
  AND rejected_date IS NULL
);

-- 3) Limit vendor PII to Super Admins and the vendor's own account
DROP POLICY IF EXISTS "vendors staff read" ON public.vendors;
DROP POLICY IF EXISTS "vendors staff manage" ON public.vendors;

CREATE POLICY "vendors admin manage"
ON public.vendors
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "vendors self read"
ON public.vendors
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Non-sensitive vendor directory for purchase staff
CREATE OR REPLACE VIEW public.vendor_directory
WITH (security_invoker = false) AS
SELECT id, vendor_code, vendor_name, status, user_id, created_at
FROM public.vendors
WHERE public.is_staff() OR user_id = auth.uid();

REVOKE ALL ON public.vendor_directory FROM PUBLIC, anon;
GRANT SELECT ON public.vendor_directory TO authenticated;
GRANT ALL ON public.vendor_directory TO service_role;