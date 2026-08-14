
-- ROLES
CREATE TYPE public.app_role AS ENUM ('super_admin','purchase','vendor');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'purchase');
$$;

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff());
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ACCOUNT APPROVALS
CREATE TABLE public.account_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  "displayName" text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Pending',
  "isActive" boolean NOT NULL DEFAULT true,
  approved_by uuid,
  approved_date timestamptz,
  rejected_by uuid,
  rejected_date timestamptz,
  rejection_reason text,
  correction_message text,
  last_updated timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_approval_requests TO authenticated;
GRANT ALL ON public.account_approval_requests TO service_role;
ALTER TABLE public.account_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approval self read" ON public.account_approval_requests FOR SELECT TO authenticated USING ("userId" = auth.uid() OR public.is_admin());
CREATE POLICY "approval admin manage" ON public.account_approval_requests FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- DEPARTMENTS
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dept read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept staff manage" ON public.departments FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

INSERT INTO public.departments (code, name) VALUES
  ('IT','IT'), ('GUDIBOX','Gudibox'), ('SPARES','Spares'), ('CONSUMABLES','Consumables');

-- VENDORS
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code text NOT NULL UNIQUE,
  vendor_name text NOT NULL,
  contact_person text,
  mobile text,
  email text,
  address text,
  gst text,
  pan text,
  scope_of_supply text,
  designation text,
  sales_manager text,
  status text NOT NULL DEFAULT 'Active',
  user_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.my_vendor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.vendors WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "vendors staff read" ON public.vendors FOR SELECT TO authenticated USING (public.is_staff() OR user_id = auth.uid());
CREATE POLICY "vendors staff manage" ON public.vendors FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ITEMS
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code text NOT NULL UNIQUE,
  item_name text NOT NULL,
  description text,
  specification text,
  unit text NOT NULL DEFAULT 'NOS',
  category text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items read" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items staff manage" ON public.items FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- PURCHASE REQUIREMENTS
CREATE TABLE public.purchase_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id),
  item_id uuid NOT NULL REFERENCES public.items(id),
  vendor_id uuid REFERENCES public.vendors(id),
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'NOS',
  required_date date,
  remarks text,
  status text NOT NULL DEFAULT 'Pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, item_id, vendor_id, required_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requirements TO authenticated;
GRANT ALL ON public.purchase_requirements TO service_role;
ALTER TABLE public.purchase_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req staff all" ON public.purchase_requirements FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "req vendor read own" ON public.purchase_requirements FOR SELECT TO authenticated USING (vendor_id IS NOT NULL AND vendor_id = public.my_vendor_id());

-- QUOTATIONS
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.purchase_requirements(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id),
  item_id uuid NOT NULL REFERENCES public.items(id),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  offer_number text NOT NULL,
  offer_date date NOT NULL DEFAULT current_date,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  delivery_terms text,
  payment_terms text,
  contact_person text,
  contact_number text,
  status text NOT NULL DEFAULT 'Draft',
  review_flag boolean NOT NULL DEFAULT false,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_id, vendor_id, offer_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qt staff all" ON public.quotations FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "qt vendor read own" ON public.quotations FOR SELECT TO authenticated USING (vendor_id = public.my_vendor_id());
CREATE POLICY "qt vendor insert own" ON public.quotations FOR INSERT TO authenticated WITH CHECK (vendor_id = public.my_vendor_id());
CREATE POLICY "qt vendor update own" ON public.quotations FOR UPDATE TO authenticated USING (vendor_id = public.my_vendor_id()) WITH CHECK (vendor_id = public.my_vendor_id());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "notif own update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif staff insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff() OR user_id = auth.uid());

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name text,
  action text NOT NULL,
  record_id text,
  status text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- NEW USER HANDLER: profile + approval request; first user becomes super admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_count int;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1));

  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, v_name, COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO v_count FROM public.user_roles WHERE role = 'super_admin';

  IF v_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.account_approval_requests ("userId","displayName",email,status,"isActive",approved_date,last_updated)
    VALUES (NEW.id, v_name, COALESCE(NEW.email,''), 'Approved', true, now(), now())
    ON CONFLICT ("userId") DO NOTHING;
  ELSE
    INSERT INTO public.account_approval_requests ("userId","displayName",email,status,"isActive",last_updated)
    VALUES (NEW.id, v_name, COALESCE(NEW.email,''), 'Pending', true, now())
    ON CONFLICT ("userId") DO NOTHING;
  END IF;

  INSERT INTO public.audit_log (user_id, user_name, action, record_id, status)
  VALUES (NEW.id, v_name, 'User Created', NEW.id::text, 'Created');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
