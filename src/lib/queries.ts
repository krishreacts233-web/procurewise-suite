import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}
export interface Item {
  id: string;
  item_code: string;
  item_name: string;
  description: string | null;
  specification: string | null;
  unit: string;
  category: string | null;
  status: string;
}
export interface Vendor {
  id: string;
  vendor_code: string;
  vendor_name: string;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  gst: string | null;
  pan: string | null;
  scope_of_supply: string | null;
  designation: string | null;
  sales_manager: string | null;
  status: string;
  user_id: string | null;
}
export interface Requirement {
  id: string;
  department_id: string;
  item_id: string;
  vendor_id: string | null;
  quantity: number;
  unit: string;
  required_date: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
  departments: { code: string; name: string } | null;
  items: { item_code: string; item_name: string; specification: string | null } | null;
  vendors: { vendor_code: string; vendor_name: string } | null;
}
export interface Quotation {
  id: string;
  requirement_id: string;
  department_id: string;
  item_id: string;
  vendor_id: string;
  offer_number: string;
  offer_date: string;
  quantity: number;
  rate: number;
  total: number;
  delivery_terms: string | null;
  payment_terms: string | null;
  contact_person: string | null;
  contact_number: string | null;
  status: string;
  review_flag: boolean;
  attachment_url: string | null;
  created_at: string;
  departments: { code: string; name: string } | null;
  items: { item_code: string; item_name: string } | null;
  vendors: { vendor_code: string; vendor_name: string } | null;
}

export const REQ_STATUSES = [
  "Pending",
  "Vendor Assigned",
  "Quotation Requested",
  "Quotation Received",
  "Under Review",
  "Comparison Completed",
  "Approved",
  "Rejected",
  "Completed",
];

export const QUOTE_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Pending",
];

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("code");
      if (error) {
        console.error("[DEPARTMENT]", error.message);
        throw error;
      }
      return data as Department[];
    },
  });
}

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("item_code");
      if (error) {
        console.error("[ITEM]", error.message);
        throw error;
      }
      return data as Item[];
    },
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").order("vendor_name");
      if (error) {
        console.error("[VENDOR]", error.message);
        throw error;
      }
      return data as Vendor[];
    },
  });
}

const REQ_SELECT =
  "*, departments(code,name), items(item_code,item_name,specification), vendors(vendor_code,vendor_name)";

export function useRequirements() {
  return useQuery({
    queryKey: ["requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requirements")
        .select(REQ_SELECT)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[PURCHASE]", error.message);
        throw error;
      }
      return data as unknown as Requirement[];
    },
  });
}

const QUOTE_SELECT =
  "*, departments(code,name), items(item_code,item_name), vendors(vendor_code,vendor_name)";

export function useQuotations() {
  return useQuery({
    queryKey: ["quotations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select(QUOTE_SELECT)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[QUOTATION]", error.message);
        throw error;
      }
      return data as unknown as Quotation[];
    },
  });
}

export function statusTone(status: string) {
  switch (status) {
    case "Approved":
    case "Completed":
    case "Active":
      return "bg-success/15 text-success border-success/30";
    case "Rejected":
    case "Disabled":
    case "Inactive":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "Pending":
    case "Draft":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-primary/15 text-primary border-primary/30";
  }
}
