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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoice_counters: {
        Row: {
          fy: string
          last_no: number
        }
        Insert: {
          fy: string
          last_no?: number
        }
        Update: {
          fy?: string
          last_no?: number
        }
        Relationships: []
      }
      materials: {
        Row: {
          created_at: string
          id: string
          last_rate_per_kg: number
          name: string
          rack_location: string | null
          reorder_kg: number
          stock_kg: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_rate_per_kg?: number
          name: string
          rack_location?: string | null
          reorder_kg?: number
          stock_kg?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_rate_per_kg?: number
          name?: string
          rack_location?: string | null
          reorder_kg?: number
          stock_kg?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          gstin: string | null
          id: string
          phone: string | null
          unit_name: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          gstin?: string | null
          id: string
          phone?: string | null
          unit_name?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          phone?: string | null
          unit_name?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          material_id: string
          paid: boolean
          qty_kg: number
          rate_per_kg: number
          supplier: string
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          paid?: boolean
          qty_kg: number
          rate_per_kg: number
          supplier: string
          total_amount?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          paid?: boolean
          qty_kg?: number
          rate_per_kg?: number
          supplier?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          attachment_path: string | null
          created_at: string
          customer: string
          customer_gstin: string | null
          customer_phone: string | null
          delivery_date: string | null
          delivery_option: string
          design_notes: string | null
          design_path: string | null
          discount_amount: number
          gst_rate: number
          gst_type: string
          id: string
          invoice_no: string | null
          item: string
          line_items: Json
          offer_type: string
          offer_value: number
          paid_amount: number
          payment_mode: string
          pieces: number
          rate_per_piece: number
          staff_name: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          user_id: string
          voice_note_path: string | null
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          customer: string
          customer_gstin?: string | null
          customer_phone?: string | null
          delivery_date?: string | null
          delivery_option?: string
          design_notes?: string | null
          design_path?: string | null
          discount_amount?: number
          gst_rate?: number
          gst_type?: string
          id?: string
          invoice_no?: string | null
          item: string
          line_items?: Json
          offer_type?: string
          offer_value?: number
          paid_amount?: number
          payment_mode?: string
          pieces: number
          rate_per_piece: number
          staff_name?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          user_id?: string
          voice_note_path?: string | null
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          customer?: string
          customer_gstin?: string | null
          customer_phone?: string | null
          delivery_date?: string | null
          delivery_option?: string
          design_notes?: string | null
          design_path?: string | null
          discount_amount?: number
          gst_rate?: number
          gst_type?: string
          id?: string
          invoice_no?: string | null
          item?: string
          line_items?: Json
          offer_type?: string
          offer_value?: number
          paid_amount?: number
          payment_mode?: string
          pieces?: number
          rate_per_piece?: number
          staff_name?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          user_id?: string
          voice_note_path?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_job_events: {
        Row: {
          created_at: string
          id: string
          job_id: string
          stage: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          stage: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          stage?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "work_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_job_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      work_jobs: {
        Row: {
          created_at: string
          id: string
          item: string
          job_no: string
          pieces: number
          sale_id: string | null
          stage: string
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item: string
          job_no: string
          pieces: number
          sale_id?: string | null
          stage?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item?: string
          job_no?: string
          pieces?: number
          sale_id?: string | null
          stage?: string
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_jobs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_jobs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          id: string
          name: string
          rate_per_piece: number
          stage: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rate_per_piece?: number
          stage?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rate_per_piece?: number
          stage?: string
          user_id?: string
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
      next_invoice_no: { Args: { _at?: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "staff"],
    },
  },
} as const
