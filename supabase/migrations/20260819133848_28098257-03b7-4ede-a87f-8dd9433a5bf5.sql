DROP VIEW IF EXISTS public.vendor_directory;

-- Row-level: staff and the vendor's own login may read vendor rows
DROP POLICY IF EXISTS "vendors staff read" ON public.vendors;
CREATE POLICY "vendors staff read"
ON public.vendors
FOR SELECT
TO authenticated
USING (public.is_staff() OR user_id = auth.uid());

-- Column-level: hide PII columns from the Data API for signed-in users
REVOKE SELECT ON public.vendors FROM authenticated;
GRANT SELECT (id, vendor_code, vendor_name, status, scope_of_supply, user_id, created_at)
  ON public.vendors TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;