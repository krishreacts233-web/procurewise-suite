ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS whatsapp text;

CREATE SEQUENCE IF NOT EXISTS public.requirement_no_seq;

ALTER TABLE public.purchase_requirements
  ADD COLUMN IF NOT EXISTS requirement_no text,
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS whatsapp_status text NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS sms_status text NOT NULL DEFAULT 'Pending';

UPDATE public.purchase_requirements
SET requirement_no = 'PR-' || lpad(nextval('public.requirement_no_seq')::text, 6, '0')
WHERE requirement_no IS NULL;

ALTER TABLE public.purchase_requirements
  ALTER COLUMN requirement_no SET DEFAULT 'PR-' || lpad(nextval('public.requirement_no_seq')::text, 6, '0');

ALTER TABLE public.purchase_requirements
  ALTER COLUMN requirement_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_requirements_requirement_no_key
  ON public.purchase_requirements (requirement_no);

CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid REFERENCES public.purchase_requirements(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  channel text NOT NULL,
  recipient text,
  message text,
  status text NOT NULL DEFAULT 'Pending',
  provider_response text,
  retry_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif log staff all" ON public.notification_log
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "notif log vendor read own" ON public.notification_log
  FOR SELECT TO authenticated USING (vendor_id IS NOT NULL AND vendor_id = public.my_vendor_id());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_notification_log_updated_at ON public.notification_log;
CREATE TRIGGER update_notification_log_updated_at
  BEFORE UPDATE ON public.notification_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();