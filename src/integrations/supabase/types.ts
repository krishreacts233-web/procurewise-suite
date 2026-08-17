export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      account_approval_requests: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          correction_message: string | null
          displayName: string
          email: string
          id: string
          isActive: boolean
          last_updated: string
          rejected_by: string | null
          rejected_date: string | null
          rejection_reason: string | null
          status: string
          userId: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          correction_message?: string | null
          displayName?: string
          email?: string
          id?: string
          isActive?: boolean
          last_updated?: string
          rejected_by?: string | null
          rejected_date?: string | null
          rejection_reason?: string | null
          status?: string
          userId: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          correction_message?: string | null
          displayName?: string
          email?: string
          id?: string
          isActive?: boolean
          last_updated?: string
          rejected_by?: string | null
          rejected_date?: string | null
          rejection_reason?: string | null
          status?: string
          userId?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          record_id: string | null
          status: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          record_id?: string | null
          status?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          record_id?: string | null
          status?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          item_code: string
          item_name: string
          specification: string | null
          status: string
          unit: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_code: string
          item_name: string
          specification?: string | null
          status?: string
          unit?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_code?: string
          item_name?: string
          specification?: string | null
          status?: string
          unit?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          id: string
          message: string | null
          provider_response: string | null
          recipient: string | null
          requirement_id: string | null
          retry_count: number
          sent_at: string | null
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          message?: string | null
          provider_response?: string | null
          recipient?: string | null
          requirement_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          provider_response?: string | null
          recipient?: string | null
          requirement_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "purchase_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          is_active: boolean
          last_login: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          id: string
          is_active?: boolean
          last_login?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_requirements: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          email_status: string
          id: string
          item_id: string
          quantity: number
          remarks: string | null
          required_date: string | null
          requirement_no: string
          sms_status: string
          status: string
          unit: string
          updated_at: string
          vendor_id: string | null
          whatsapp_status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          email_status?: string
          id?: string
          item_id: string
          quantity?: number
          remarks?: string | null
          required_date?: string | null
          requirement_no?: string
          sms_status?: string
          status?: string
          unit?: string
          updated_at?: string
          vendor_id?: string | null
          whatsapp_status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          email_status?: string
          id?: string
          item_id?: string
          quantity?: number
          remarks?: string | null
          required_date?: string | null
          requirement_no?: string
          sms_status?: string
          status?: string
          unit?: string
          updated_at?: string
          vendor_id?: string | null
          whatsapp_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requirements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requirements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requirements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          attachment_url: string | null
          contact_number: string | null
          contact_person: string | null
          created_at: string
          delivery_terms: string | null
          department_id: string
          id: string
          item_id: string
          offer_date: string
          offer_number: string
          payment_terms: string | null
          quantity: number
          rate: number
          requirement_id: string
          review_flag: boolean
          status: string
          total: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          attachment_url?: string | null
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string
          delivery_terms?: string | null
          department_id: string
          id?: string
          item_id: string
          offer_date?: string
          offer_number: string
          payment_terms?: string | null
          quantity?: number
          rate?: number
          requirement_id: string
          review_flag?: boolean
          status?: string
          total?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          attachment_url?: string | null
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string
          delivery_terms?: string | null
          department_id?: string
          id?: string
          item_id?: string
          offer_date?: string
          offer_number?: string
          payment_terms?: string | null
          quantity?: number
          rate?: number
          requirement_id?: string
          review_flag?: boolean
          status?: string
          total?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "purchase_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          designation: string | null
          email: string | null
          gst: string | null
          id: string
          mobile: string | null
          pan: string | null
          sales_manager: string | null
          scope_of_supply: string | null
          status: string
          user_id: string | null
          vendor_code: string
          vendor_name: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          gst?: string | null
          id?: string
          mobile?: string | null
          pan?: string | null
          sales_manager?: string | null
          scope_of_supply?: string | null
          status?: string
          user_id?: string | null
          vendor_code: string
          vendor_name: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          gst?: string | null
          id?: string
          mobile?: string | null
          pan?: string | null
          sales_manager?: string | null
          scope_of_supply?: string | null
          status?: string
          user_id?: string | null
          vendor_code?: string
          vendor_name?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      my_vendor_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "purchase" | "vendor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "purchase", "vendor"],
    },
  },
} as const
