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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_name?: string | null
        }
        Relationships: []
      }
      ai_learned_mappings: {
        Row: {
          confidence: number | null
          created_at: string | null
          entity_type: string
          extracted_value: string
          id: string
          last_used_at: string | null
          matched_id: string
          updated_at: string | null
          use_count: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          entity_type: string
          extracted_value: string
          id?: string
          last_used_at?: string | null
          matched_id: string
          updated_at?: string | null
          use_count?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          entity_type?: string
          extracted_value?: string
          id?: string
          last_used_at?: string | null
          matched_id?: string
          updated_at?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      bid_package_documents: {
        Row: {
          bid_package_id: string
          description: string | null
          document_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          bid_package_id: string
          description?: string | null
          document_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          bid_package_id?: string
          description?: string | null
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_package_documents_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "bid_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_package_invites: {
        Row: {
          bid_package_id: string
          declined: boolean | null
          declined_reason: string | null
          id: string
          invite_sent: boolean | null
          invite_sent_at: string | null
          invited_at: string
          vendor_id: string
          viewed_at: string | null
        }
        Insert: {
          bid_package_id: string
          declined?: boolean | null
          declined_reason?: string | null
          id?: string
          invite_sent?: boolean | null
          invite_sent_at?: string | null
          invited_at?: string
          vendor_id: string
          viewed_at?: string | null
        }
        Update: {
          bid_package_id?: string
          declined?: boolean | null
          declined_reason?: string | null
          id?: string
          invite_sent?: boolean | null
          invite_sent_at?: string | null
          invited_at?: string
          vendor_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_package_invites_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "bid_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_package_invites_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_packages: {
        Row: {
          awarded_amount: number | null
          awarded_at: string | null
          awarded_vendor_id: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          issue_date: string | null
          job_id: string | null
          package_number: string
          scope_of_work: string | null
          site_visit_date: string | null
          site_visit_time: string | null
          special_requirements: string | null
          specs_summary: string | null
          square_footage: number | null
          status: string
          title: string
          trade_category: string
          updated_at: string
        }
        Insert: {
          awarded_amount?: number | null
          awarded_at?: string | null
          awarded_vendor_id?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          issue_date?: string | null
          job_id?: string | null
          package_number: string
          scope_of_work?: string | null
          site_visit_date?: string | null
          site_visit_time?: string | null
          special_requirements?: string | null
          specs_summary?: string | null
          square_footage?: number | null
          status?: string
          title: string
          trade_category: string
          updated_at?: string
        }
        Update: {
          awarded_amount?: number | null
          awarded_at?: string | null
          awarded_vendor_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          issue_date?: string | null
          job_id?: string | null
          package_number?: string
          scope_of_work?: string | null
          site_visit_date?: string | null
          site_visit_time?: string | null
          special_requirements?: string | null
          specs_summary?: string | null
          square_footage?: number | null
          status?: string
          title?: string
          trade_category?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_packages_awarded_vendor_id_fkey"
            columns: ["awarded_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_packages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          budgeted_amount: number
          cost_code_id: string
          created_at: string
          id: string
          job_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          budgeted_amount?: number
          cost_code_id: string
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          budgeted_amount?: number
          cost_code_id?: string
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_signature_required: boolean | null
          client_signed_at: string | null
          co_number: string
          created_at: string
          days_impact: number | null
          description: string
          draw_id: string | null
          id: string
          job_id: string
          markup_amount: number | null
          markup_percent: number | null
          notes: string | null
          pm_cost: number | null
          pm_hourly_rate: number | null
          pm_hours: number | null
          po_id: string | null
          requested_by: string | null
          status: string
          subtotal: number
          total_amount: number | null
          type: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_signature_required?: boolean | null
          client_signed_at?: string | null
          co_number: string
          created_at?: string
          days_impact?: number | null
          description: string
          draw_id?: string | null
          id?: string
          job_id: string
          markup_amount?: number | null
          markup_percent?: number | null
          notes?: string | null
          pm_cost?: number | null
          pm_hourly_rate?: number | null
          pm_hours?: number | null
          po_id?: string | null
          requested_by?: string | null
          status?: string
          subtotal?: number
          total_amount?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_signature_required?: boolean | null
          client_signed_at?: string | null
          co_number?: string
          created_at?: string
          days_impact?: number | null
          description?: string
          draw_id?: string | null
          id?: string
          job_id?: string
          markup_amount?: number | null
          markup_percent?: number | null
          notes?: string | null
          pm_cost?: number | null
          pm_hourly_rate?: number | null
          pm_hours?: number | null
          po_id?: string | null
          requested_by?: string | null
          status?: string
          subtotal?: number
          total_amount?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      co_line_items: {
        Row: {
          amount: number
          change_order_id: string
          cost_code_id: string | null
          created_at: string
          description: string
          id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          amount?: number
          change_order_id: string
          cost_code_id?: string | null
          created_at?: string
          description: string
          id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          change_order_id?: string
          cost_code_id?: string | null
          created_at?: string
          description?: string
          id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "co_line_items_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "co_line_items_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_codes: {
        Row: {
          category: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_log_attachments: {
        Row: {
          caption: string | null
          category: string | null
          daily_log_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          category?: string | null
          daily_log_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          category?: string | null
          daily_log_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_log_attachments_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_log_crew: {
        Row: {
          completion_percent: number | null
          created_at: string
          daily_log_id: string
          hours_worked: number | null
          id: string
          notes: string | null
          po_id: string | null
          schedule_task_id: string | null
          trade: string | null
          updated_at: string
          vendor_id: string | null
          work_area: string | null
          worker_count: number | null
        }
        Insert: {
          completion_percent?: number | null
          created_at?: string
          daily_log_id: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          po_id?: string | null
          schedule_task_id?: string | null
          trade?: string | null
          updated_at?: string
          vendor_id?: string | null
          work_area?: string | null
          worker_count?: number | null
        }
        Update: {
          completion_percent?: number | null
          created_at?: string
          daily_log_id?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          po_id?: string | null
          schedule_task_id?: string | null
          trade?: string | null
          updated_at?: string
          vendor_id?: string | null
          work_area?: string | null
          worker_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_log_crew_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_log_crew_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_log_crew_schedule_task_id_fkey"
            columns: ["schedule_task_id"]
            isOneToOne: false
            referencedRelation: "schedule_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_log_crew_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_log_deliveries: {
        Row: {
          created_at: string
          daily_log_id: string
          description: string
          id: string
          notes: string | null
          po_id: string | null
          quantity: number | null
          received_by: string | null
          unit: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          daily_log_id: string
          description: string
          id?: string
          notes?: string | null
          po_id?: string | null
          quantity?: number | null
          received_by?: string | null
          unit?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          daily_log_id?: string
          description?: string
          id?: string
          notes?: string | null
          po_id?: string | null
          quantity?: number | null
          received_by?: string | null
          unit?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_log_deliveries_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_log_deliveries_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_log_deliveries_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_log_inspections: {
        Row: {
          created_at: string
          daily_log_id: string
          id: string
          inspection_type: string
          inspector: string | null
          notes: string | null
          result: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_log_id: string
          id?: string
          inspection_type: string
          inspector?: string | null
          notes?: string | null
          result?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_log_id?: string
          id?: string
          inspection_type?: string
          inspector?: string | null
          notes?: string | null
          result?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_log_inspections_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          absent_crews: Json | null
          completed_at: string | null
          construction_phase: string | null
          created_at: string
          created_by: string | null
          delays_issues: string | null
          deleted_at: string | null
          dumpster_exchange: boolean | null
          id: string
          job_id: string
          log_date: string
          plan_completed: string | null
          plan_variance_notes: string | null
          safety_notes: string | null
          site_visitors: string | null
          status: string
          temperature_high: number | null
          temperature_low: number | null
          updated_at: string
          weather_conditions: string | null
          weather_notes: string | null
          work_completed: string | null
          work_planned: string | null
        }
        Insert: {
          absent_crews?: Json | null
          completed_at?: string | null
          construction_phase?: string | null
          created_at?: string
          created_by?: string | null
          delays_issues?: string | null
          deleted_at?: string | null
          dumpster_exchange?: boolean | null
          id?: string
          job_id: string
          log_date: string
          plan_completed?: string | null
          plan_variance_notes?: string | null
          safety_notes?: string | null
          site_visitors?: string | null
          status?: string
          temperature_high?: number | null
          temperature_low?: number | null
          updated_at?: string
          weather_conditions?: string | null
          weather_notes?: string | null
          work_completed?: string | null
          work_planned?: string | null
        }
        Update: {
          absent_crews?: Json | null
          completed_at?: string | null
          construction_phase?: string | null
          created_at?: string
          created_by?: string | null
          delays_issues?: string | null
          deleted_at?: string | null
          dumpster_exchange?: boolean | null
          id?: string
          job_id?: string
          log_date?: string
          plan_completed?: string | null
          plan_variance_notes?: string | null
          safety_notes?: string | null
          site_visitors?: string | null
          status?: string
          temperature_high?: number | null
          temperature_low?: number | null
          updated_at?: string
          weather_conditions?: string | null
          weather_notes?: string | null
          work_completed?: string | null
          work_planned?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      description_cost_mappings: {
        Row: {
          cost_code_id: string
          created_at: string | null
          id: string
          keyword: string
          match_type: string | null
          priority: number | null
        }
        Insert: {
          cost_code_id: string
          created_at?: string | null
          id?: string
          keyword: string
          match_type?: string | null
          priority?: number | null
        }
        Update: {
          cost_code_id?: string
          created_at?: string | null
          id?: string
          keyword?: string
          match_type?: string | null
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "description_cost_mappings_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      draws: {
        Row: {
          application_date: string | null
          created_at: string
          current_payment_due: number | null
          draw_number: number
          funded_amount: number | null
          funded_at: string | null
          id: string
          job_id: string
          notes: string | null
          period_end: string
          period_start: string
          retainage_amount: number | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          total_completed: number | null
          updated_at: string
        }
        Insert: {
          application_date?: string | null
          created_at?: string
          current_payment_due?: number | null
          draw_number: number
          funded_amount?: number | null
          funded_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          period_end: string
          period_start: string
          retainage_amount?: number | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_completed?: number | null
          updated_at?: string
        }
        Update: {
          application_date?: string | null
          created_at?: string
          current_payment_due?: number | null
          draw_number?: number
          funded_amount?: number | null
          funded_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          retainage_amount?: number | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_completed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draws_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          avatar_url: string | null
          base_hourly_rate: number | null
          burden_class_id: string | null
          burdened_hourly_rate: number | null
          created_at: string
          department: string | null
          email: string | null
          first_name: string
          hourly_rate: number | null
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          base_hourly_rate?: number | null
          burden_class_id?: string | null
          burdened_hourly_rate?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          base_hourly_rate?: number | null
          burden_class_id?: string | null
          burdened_hourly_rate?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_burden_class_id_fkey"
            columns: ["burden_class_id"]
            isOneToOne: false
            referencedRelation: "v2_burden_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_templates: {
        Row: {
          category: string
          clarifications: Json
          created_at: string
          created_by: string | null
          description: string | null
          exclusions: Json
          id: string
          is_active: boolean
          is_default: boolean
          markup_settings: Json
          name: string
          project_type: string | null
          sections: Json
          sort_order: number | null
          terms_and_conditions: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          clarifications?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          exclusions?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          markup_settings?: Json
          name: string
          project_type?: string | null
          sections?: Json
          sort_order?: number | null
          terms_and_conditions?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          clarifications?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          exclusions?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          markup_settings?: Json
          name?: string
          project_type?: string | null
          sections?: Json
          sort_order?: number | null
          terms_and_conditions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estimates: {
        Row: {
          allowances: Json
          approved_at: string | null
          assigned_to: string | null
          clarifications: Json
          client_address: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          contingency_amount: number
          converted_to_job_id: string | null
          created_at: string
          created_by: string
          exclusions: Json
          expires_at: string | null
          id: string
          job_id: string | null
          lead_id: string | null
          markup_settings: Json
          notes: string | null
          number: string
          overhead_amount: number
          parent_estimate_id: string | null
          profit_amount: number
          project_address: string | null
          project_description: string | null
          project_name: string
          project_square_feet: number | null
          project_type: string
          sections: Json
          sent_at: string | null
          status: string
          subtotal_direct: number
          subtotal_equipment: number
          subtotal_labor: number
          subtotal_material: number
          subtotal_other: number
          subtotal_subcontractor: number
          terms_and_conditions: string | null
          total_allowances: number
          total_amount: number
          total_before_contingency: number
          updated_at: string
          version: number
        }
        Insert: {
          allowances?: Json
          approved_at?: string | null
          assigned_to?: string | null
          clarifications?: Json
          client_address?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          contingency_amount?: number
          converted_to_job_id?: string | null
          created_at?: string
          created_by?: string
          exclusions?: Json
          expires_at?: string | null
          id?: string
          job_id?: string | null
          lead_id?: string | null
          markup_settings?: Json
          notes?: string | null
          number: string
          overhead_amount?: number
          parent_estimate_id?: string | null
          profit_amount?: number
          project_address?: string | null
          project_description?: string | null
          project_name: string
          project_square_feet?: number | null
          project_type?: string
          sections?: Json
          sent_at?: string | null
          status?: string
          subtotal_direct?: number
          subtotal_equipment?: number
          subtotal_labor?: number
          subtotal_material?: number
          subtotal_other?: number
          subtotal_subcontractor?: number
          terms_and_conditions?: string | null
          total_allowances?: number
          total_amount?: number
          total_before_contingency?: number
          updated_at?: string
          version?: number
        }
        Update: {
          allowances?: Json
          approved_at?: string | null
          assigned_to?: string | null
          clarifications?: Json
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          contingency_amount?: number
          converted_to_job_id?: string | null
          created_at?: string
          created_by?: string
          exclusions?: Json
          expires_at?: string | null
          id?: string
          job_id?: string | null
          lead_id?: string | null
          markup_settings?: Json
          notes?: string | null
          number?: string
          overhead_amount?: number
          parent_estimate_id?: string | null
          profit_amount?: number
          project_address?: string | null
          project_description?: string | null
          project_name?: string
          project_square_feet?: number | null
          project_type?: string
          sections?: Json
          sent_at?: string | null
          status?: string
          subtotal_direct?: number
          subtotal_equipment?: number
          subtotal_labor?: number
          subtotal_material?: number
          subtotal_other?: number
          subtotal_subcontractor?: number
          terms_and_conditions?: string | null
          total_allowances?: number
          total_amount?: number
          total_before_contingency?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimates_converted_to_job_id_fkey"
            columns: ["converted_to_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_parent_estimate_id_fkey"
            columns: ["parent_estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          frequency: string | null
          id: string
          name: string
          next_due_date: string | null
          notes: string | null
          payment_date: string | null
          recurring: boolean
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          name: string
          next_due_date?: string | null
          notes?: string | null
          payment_date?: string | null
          recurring?: boolean
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          name?: string
          next_due_date?: string | null
          notes?: string | null
          payment_date?: string | null
          recurring?: boolean
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_allocations: {
        Row: {
          amount: number
          cost_code_id: string | null
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          cost_code_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cost_code_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_allocations_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          ai_confidence: Json | null
          ai_extracted_data: Json | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          draw_id: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          is_credit: boolean | null
          is_split_child: boolean | null
          job_id: string | null
          matched_confidence: Json | null
          needs_review: boolean | null
          notes: string | null
          paid_at: string | null
          parent_invoice_id: string | null
          payment_reference: string | null
          pdf_url: string | null
          po_id: string | null
          received_date: string | null
          review_flags: string[] | null
          pdf_stamped_url: string | null
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          ai_confidence?: Json | null
          ai_extracted_data?: Json | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          draw_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          is_credit?: boolean | null
          is_split_child?: boolean | null
          job_id?: string | null
          matched_confidence?: Json | null
          needs_review?: boolean | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          po_id?: string | null
          received_date?: string | null
          review_flags?: string[] | null
          pdf_stamped_url?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          ai_confidence?: Json | null
          ai_extracted_data?: Json | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          draw_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_credit?: boolean | null
          is_split_child?: boolean | null
          job_id?: string | null
          matched_confidence?: Json | null
          needs_review?: boolean | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          po_id?: string | null
          received_date?: string | null
          review_flags?: string[] | null
          pdf_stamped_url?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_end_date: string | null
          address: string | null
          architect: string | null
          architectural_style: string | null
          bathrooms: number | null
          bedrooms: number | null
          budget_amount: number | null
          client: string | null
          client_cell: string | null
          client_email: string | null
          client_phone: string | null
          construction_type: string | null
          contract_amount: number | null
          created_at: string
          electrical_service: string | null
          end_date: string | null
          engineer: string | null
          exterior_finish: string | null
          flood_zone: string | null
          foundation_type: string | null
          garage_spaces: number | null
          half_baths: number | null
          hvac_system: string | null
          id: string
          lot_size: number | null
          monthly_supervision_rate: number | null
          name: string
          notes: string | null
          parcel_id: string | null
          percent_complete: number | null
          permit_number: string | null
          plumbing_type: string | null
          premium_features: string[] | null
          project_manager: string | null
          retainage_percent: number | null
          roof_type: string | null
          site_supervisor: string | null
          square_footage: number | null
          start_date: string | null
          status: string
          stories: number | null
          target_margin: number | null
          updated_at: string
          year_built: number | null
        }
        Insert: {
          actual_end_date?: string | null
          address?: string | null
          architect?: string | null
          architectural_style?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          budget_amount?: number | null
          client?: string | null
          client_cell?: string | null
          client_email?: string | null
          client_phone?: string | null
          construction_type?: string | null
          contract_amount?: number | null
          created_at?: string
          electrical_service?: string | null
          end_date?: string | null
          engineer?: string | null
          exterior_finish?: string | null
          flood_zone?: string | null
          foundation_type?: string | null
          garage_spaces?: number | null
          half_baths?: number | null
          hvac_system?: string | null
          id?: string
          lot_size?: number | null
          monthly_supervision_rate?: number | null
          name: string
          notes?: string | null
          parcel_id?: string | null
          percent_complete?: number | null
          permit_number?: string | null
          plumbing_type?: string | null
          premium_features?: string[] | null
          project_manager?: string | null
          retainage_percent?: number | null
          roof_type?: string | null
          site_supervisor?: string | null
          square_footage?: number | null
          start_date?: string | null
          status?: string
          stories?: number | null
          target_margin?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          actual_end_date?: string | null
          address?: string | null
          architect?: string | null
          architectural_style?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          budget_amount?: number | null
          client?: string | null
          client_cell?: string | null
          client_email?: string | null
          client_phone?: string | null
          construction_type?: string | null
          contract_amount?: number | null
          created_at?: string
          electrical_service?: string | null
          end_date?: string | null
          engineer?: string | null
          exterior_finish?: string | null
          flood_zone?: string | null
          foundation_type?: string | null
          garage_spaces?: number | null
          half_baths?: number | null
          hvac_system?: string | null
          id?: string
          lot_size?: number | null
          monthly_supervision_rate?: number | null
          name?: string
          notes?: string | null
          parcel_id?: string | null
          percent_complete?: number | null
          permit_number?: string | null
          plumbing_type?: string | null
          premium_features?: string[] | null
          project_manager?: string | null
          retainage_percent?: number | null
          roof_type?: string | null
          site_supervisor?: string | null
          square_footage?: number | null
          start_date?: string | null
          status?: string
          stories?: number | null
          target_margin?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          days_in_stage: number | null
          description: string | null
          estimated_value: number | null
          id: string
          name: string
          next_follow_up: string | null
          notes: string | null
          priority: string | null
          source: string | null
          square_footage: number | null
          stage: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          days_in_stage?: number | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          name: string
          next_follow_up?: string | null
          notes?: string | null
          priority?: string | null
          source?: string | null
          square_footage?: number | null
          stage?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          days_in_stage?: number | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          name?: string
          next_follow_up?: string | null
          notes?: string | null
          priority?: string | null
          source?: string | null
          square_footage?: number | null
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      lien_releases: {
        Row: {
          amount: number
          created_at: string
          document_url: string | null
          draw_id: string
          id: string
          job_id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          release_type: string
          status: string
          through_date: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          document_url?: string | null
          draw_id: string
          id?: string
          job_id: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          release_type: string
          status?: string
          through_date?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          document_url?: string | null
          draw_id?: string
          id?: string
          job_id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          release_type?: string
          status?: string
          through_date?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lien_releases_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lien_releases_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lien_releases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      permits: {
        Row: {
          approved_date: string | null
          created_at: string
          expires_date: string | null
          fee_amount: number | null
          fee_paid: boolean | null
          id: string
          inspector_email: string | null
          inspector_name: string | null
          inspector_phone: string | null
          job_id: string
          jurisdiction: string | null
          notes: string | null
          number: string | null
          status: string
          submitted_date: string | null
          type: string
          updated_at: string
        }
        Insert: {
          approved_date?: string | null
          created_at?: string
          expires_date?: string | null
          fee_amount?: number | null
          fee_paid?: boolean | null
          id?: string
          inspector_email?: string | null
          inspector_name?: string | null
          inspector_phone?: string | null
          job_id: string
          jurisdiction?: string | null
          notes?: string | null
          number?: string | null
          status?: string
          submitted_date?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          approved_date?: string | null
          created_at?: string
          expires_date?: string | null
          fee_amount?: number | null
          fee_paid?: boolean | null
          id?: string
          inspector_email?: string | null
          inspector_name?: string | null
          inspector_phone?: string | null
          job_id?: string
          jurisdiction?: string | null
          notes?: string | null
          number?: string | null
          status?: string
          submitted_date?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      po_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          po_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          po_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          po_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_attachments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line_items: {
        Row: {
          amount: number
          cost_code_id: string | null
          created_at: string
          description: string
          id: string
          invoiced_amount: number | null
          po_id: string
          quantity: number | null
          sort_order: number | null
          title: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          amount?: number
          cost_code_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoiced_amount?: number | null
          po_id: string
          quantity?: number | null
          sort_order?: number | null
          title?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cost_code_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoiced_amount?: number | null
          po_id?: string
          quantity?: number | null
          sort_order?: number | null
          title?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_line_items_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_line_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          change_order_amount: number | null
          created_at: string
          current_amount: number | null
          description: string | null
          id: string
          invoiced_amount: number | null
          job_id: string
          original_amount: number
          po_number: string
          remaining_amount: number | null
          scope_of_work: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          change_order_amount?: number | null
          created_at?: string
          current_amount?: number | null
          description?: string | null
          id?: string
          invoiced_amount?: number | null
          job_id: string
          original_amount?: number
          po_number: string
          remaining_amount?: number | null
          scope_of_work?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          change_order_amount?: number | null
          created_at?: string
          current_amount?: number | null
          description?: string | null
          id?: string
          invoiced_amount?: number | null
          job_id?: string
          original_amount?: number
          po_number?: string
          remaining_amount?: number | null
          scope_of_work?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_tasks: {
        Row: {
          assigned_employee_id: string | null
          assigned_to: string | null
          color: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          critical_path: boolean
          description: string | null
          duration_days: number | null
          end_date: string
          id: string
          job_id: string
          name: string
          parent_task_id: string | null
          percent_complete: number | null
          phase: string | null
          po_id: string | null
          predecessors: Json | null
          sort_order: number | null
          start_date: string
          status: string
          tags: string[] | null
          task_type: string | null
          trades: string[] | null
          updated_at: string
        }
        Insert: {
          assigned_employee_id?: string | null
          assigned_to?: string | null
          color?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          critical_path?: boolean
          description?: string | null
          duration_days?: number | null
          end_date: string
          id?: string
          job_id: string
          name: string
          parent_task_id?: string | null
          percent_complete?: number | null
          phase?: string | null
          po_id?: string | null
          predecessors?: Json | null
          sort_order?: number | null
          start_date: string
          status?: string
          tags?: string[] | null
          task_type?: string | null
          trades?: string[] | null
          updated_at?: string
        }
        Update: {
          assigned_employee_id?: string | null
          assigned_to?: string | null
          color?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          critical_path?: boolean
          description?: string | null
          duration_days?: number | null
          end_date?: string
          id?: string
          job_id?: string
          name?: string
          parent_task_id?: string | null
          percent_complete?: number | null
          phase?: string | null
          po_id?: string | null
          predecessors?: Json | null
          sort_order?: number | null
          start_date?: string
          status?: string
          tags?: string[] | null
          task_type?: string | null
          trades?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_tasks_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "schedule_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_tasks_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      selections: {
        Row: {
          actual_cost: number | null
          allowance_amount: number | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          category: string
          client_notes: string | null
          cost_code_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          expected_delivery: string | null
          id: string
          image_url: string | null
          is_required: boolean | null
          job_id: string
          lead_time_days: number | null
          name: string
          notes: string | null
          options: Json | null
          order_status: string | null
          ordered_at: string | null
          po_id: string | null
          reference_url: string | null
          room_area: string | null
          selected_option: string | null
          sort_order: number | null
          updated_at: string
          variance: number | null
          vendor_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          allowance_amount?: number | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category: string
          client_notes?: string | null
          cost_code_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_delivery?: string | null
          id?: string
          image_url?: string | null
          is_required?: boolean | null
          job_id: string
          lead_time_days?: number | null
          name: string
          notes?: string | null
          options?: Json | null
          order_status?: string | null
          ordered_at?: string | null
          po_id?: string | null
          reference_url?: string | null
          room_area?: string | null
          selected_option?: string | null
          sort_order?: number | null
          updated_at?: string
          variance?: number | null
          vendor_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          allowance_amount?: number | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          client_notes?: string | null
          cost_code_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_delivery?: string | null
          id?: string
          image_url?: string | null
          is_required?: boolean | null
          job_id?: string
          lead_time_days?: number | null
          name?: string
          notes?: string | null
          options?: Json | null
          order_status?: string | null
          ordered_at?: string | null
          po_id?: string | null
          reference_url?: string | null
          room_area?: string | null
          selected_option?: string | null
          sort_order?: number | null
          updated_at?: string
          variance?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "selections_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selections_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selections_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selections_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_bid_items: {
        Row: {
          amount: number
          cost_code_id: string | null
          created_at: string
          description: string
          id: string
          notes: string | null
          quantity: number | null
          sort_order: number | null
          subcontractor_bid_id: string
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          amount: number
          cost_code_id?: string | null
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          quantity?: number | null
          sort_order?: number | null
          subcontractor_bid_id: string
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          amount?: number
          cost_code_id?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          quantity?: number | null
          sort_order?: number | null
          subcontractor_bid_id?: string
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_bid_items_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_bid_items_subcontractor_bid_id_fkey"
            columns: ["subcontractor_bid_id"]
            isOneToOne: false
            referencedRelation: "subcontractor_bids"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_bids: {
        Row: {
          alternate_amounts: Json | null
          bid_amount: number
          bid_package_id: string
          bond_included: boolean | null
          clarifications: Json | null
          created_at: string
          evaluation_notes: string | null
          evaluation_score: number | null
          exclusions: Json | null
          id: string
          inclusions: Json | null
          insurance_verified: boolean | null
          is_lowest_bid: boolean | null
          notes: string | null
          payment_terms: string | null
          proposal_url: string | null
          proposed_duration_days: number | null
          proposed_start_date: string | null
          ranking: number | null
          status: string
          submitted_at: string
          unit_price_per_sf: number | null
          updated_at: string
          valid_until: string | null
          vendor_id: string
          warranty_terms: string | null
        }
        Insert: {
          alternate_amounts?: Json | null
          bid_amount: number
          bid_package_id: string
          bond_included?: boolean | null
          clarifications?: Json | null
          created_at?: string
          evaluation_notes?: string | null
          evaluation_score?: number | null
          exclusions?: Json | null
          id?: string
          inclusions?: Json | null
          insurance_verified?: boolean | null
          is_lowest_bid?: boolean | null
          notes?: string | null
          payment_terms?: string | null
          proposal_url?: string | null
          proposed_duration_days?: number | null
          proposed_start_date?: string | null
          ranking?: number | null
          status?: string
          submitted_at?: string
          unit_price_per_sf?: number | null
          updated_at?: string
          valid_until?: string | null
          vendor_id: string
          warranty_terms?: string | null
        }
        Update: {
          alternate_amounts?: Json | null
          bid_amount?: number
          bid_package_id?: string
          bond_included?: boolean | null
          clarifications?: Json | null
          created_at?: string
          evaluation_notes?: string | null
          evaluation_score?: number | null
          exclusions?: Json | null
          id?: string
          inclusions?: Json | null
          insurance_verified?: boolean | null
          is_lowest_bid?: boolean | null
          notes?: string | null
          payment_terms?: string | null
          proposal_url?: string | null
          proposed_duration_days?: number | null
          proposed_start_date?: string | null
          ranking?: number | null
          status?: string
          submitted_at?: string
          unit_price_per_sf?: number | null
          updated_at?: string
          valid_until?: string | null
          vendor_id?: string
          warranty_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_bids_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "bid_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_bids_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_cost_mappings: {
        Row: {
          cost_code_id: string
          created_at: string | null
          id: string
          priority: number | null
          trade_type: string
        }
        Insert: {
          cost_code_id: string
          created_at?: string | null
          id?: string
          priority?: number | null
          trade_type: string
        }
        Update: {
          cost_code_id?: string
          created_at?: string | null
          id?: string
          priority?: number | null
          trade_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_cost_mappings_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_burden_classes: {
        Row: {
          created_at: string
          description: string | null
          fica_rate: number | null
          futa_rate: number | null
          health_insurance_rate: number | null
          id: string
          is_active: boolean | null
          name: string
          other_benefits_rate: number | null
          pto_accrual_rate: number | null
          retirement_match_rate: number | null
          suta_rate: number | null
          total_burden_rate: number | null
          updated_at: string
          workers_comp_rate: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          fica_rate?: number | null
          futa_rate?: number | null
          health_insurance_rate?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          other_benefits_rate?: number | null
          pto_accrual_rate?: number | null
          retirement_match_rate?: number | null
          suta_rate?: number | null
          total_burden_rate?: number | null
          updated_at?: string
          workers_comp_rate?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          fica_rate?: number | null
          futa_rate?: number | null
          health_insurance_rate?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          other_benefits_rate?: number | null
          pto_accrual_rate?: number | null
          retirement_match_rate?: number | null
          suta_rate?: number | null
          total_burden_rate?: number | null
          updated_at?: string
          workers_comp_rate?: number | null
        }
        Relationships: []
      }
      v2_burden_rate_history: {
        Row: {
          burden_class_id: string
          changed_by: string | null
          created_at: string
          effective_date: string
          id: string
          new_total_rate: number
          previous_total_rate: number | null
          rate_components: Json | null
          reason: string | null
        }
        Insert: {
          burden_class_id: string
          changed_by?: string | null
          created_at?: string
          effective_date?: string
          id?: string
          new_total_rate: number
          previous_total_rate?: number | null
          rate_components?: Json | null
          reason?: string | null
        }
        Update: {
          burden_class_id?: string
          changed_by?: string | null
          created_at?: string
          effective_date?: string
          id?: string
          new_total_rate?: number
          previous_total_rate?: number | null
          rate_components?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_burden_rate_history_burden_class_id_fkey"
            columns: ["burden_class_id"]
            isOneToOne: false
            referencedRelation: "v2_burden_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_current_prices: {
        Row: {
          avg_price: number | null
          id: string
          last_updated: string
          latest_price: number
          master_item_id: string
          max_price: number | null
          min_price: number | null
          price_count: number | null
          unit: string
          vendor_id: string
        }
        Insert: {
          avg_price?: number | null
          id?: string
          last_updated?: string
          latest_price: number
          master_item_id: string
          max_price?: number | null
          min_price?: number | null
          price_count?: number | null
          unit: string
          vendor_id: string
        }
        Update: {
          avg_price?: number | null
          id?: string
          last_updated?: string
          latest_price?: number
          master_item_id?: string
          max_price?: number | null
          min_price?: number | null
          price_count?: number | null
          unit?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_current_prices_master_item_id_fkey"
            columns: ["master_item_id"]
            isOneToOne: false
            referencedRelation: "v2_master_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_current_prices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_labor_bids: {
        Row: {
          bid_amount: number
          calculated_per_sf: number | null
          created_at: string
          exclusions: Json | null
          id: string
          inclusions: Json | null
          is_lowest_bid: boolean | null
          job_id: string
          labor_category_id: string
          labor_specification_id: string | null
          notes: string | null
          scope_description: string | null
          square_footage: number | null
          status: string | null
          submitted_at: string | null
          terms: string | null
          updated_at: string
          valid_until: string | null
          vendor_id: string
        }
        Insert: {
          bid_amount: number
          calculated_per_sf?: number | null
          created_at?: string
          exclusions?: Json | null
          id?: string
          inclusions?: Json | null
          is_lowest_bid?: boolean | null
          job_id: string
          labor_category_id: string
          labor_specification_id?: string | null
          notes?: string | null
          scope_description?: string | null
          square_footage?: number | null
          status?: string | null
          submitted_at?: string | null
          terms?: string | null
          updated_at?: string
          valid_until?: string | null
          vendor_id: string
        }
        Update: {
          bid_amount?: number
          calculated_per_sf?: number | null
          created_at?: string
          exclusions?: Json | null
          id?: string
          inclusions?: Json | null
          is_lowest_bid?: boolean | null
          job_id?: string
          labor_category_id?: string
          labor_specification_id?: string | null
          notes?: string | null
          scope_description?: string | null
          square_footage?: number | null
          status?: string | null
          submitted_at?: string | null
          terms?: string | null
          updated_at?: string
          valid_until?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_labor_bids_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_labor_bids_labor_category_id_fkey"
            columns: ["labor_category_id"]
            isOneToOne: false
            referencedRelation: "v2_labor_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_labor_bids_labor_specification_id_fkey"
            columns: ["labor_specification_id"]
            isOneToOne: false
            referencedRelation: "v2_labor_specifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_labor_bids_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_labor_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          max_price_per_sf: number | null
          min_price_per_sf: number | null
          name: string
          sort_order: number | null
          typical_price_per_sf: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_price_per_sf?: number | null
          min_price_per_sf?: number | null
          name: string
          sort_order?: number | null
          typical_price_per_sf?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_price_per_sf?: number | null
          min_price_per_sf?: number | null
          name?: string
          sort_order?: number | null
          typical_price_per_sf?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      v2_labor_specifications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          labor_category_id: string
          name: string
          price_multiplier: number | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          labor_category_id: string
          name: string
          price_multiplier?: number | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          labor_category_id?: string
          name?: string
          price_multiplier?: number | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_labor_specifications_labor_category_id_fkey"
            columns: ["labor_category_id"]
            isOneToOne: false
            referencedRelation: "v2_labor_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_master_items: {
        Row: {
          category: string
          created_at: string
          default_unit: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          waste_factor_percent: number | null
        }
        Insert: {
          category: string
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          waste_factor_percent?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          waste_factor_percent?: number | null
        }
        Relationships: []
      }
      v2_price_confidence: {
        Row: {
          calculated_at: string
          id: string
          master_item_id: string
          overall_confidence: number | null
          recency_score: number | null
          source_score: number | null
          variance_score: number | null
          vendor_id: string
        }
        Insert: {
          calculated_at?: string
          id?: string
          master_item_id: string
          overall_confidence?: number | null
          recency_score?: number | null
          source_score?: number | null
          variance_score?: number | null
          vendor_id: string
        }
        Update: {
          calculated_at?: string
          id?: string
          master_item_id?: string
          overall_confidence?: number | null
          recency_score?: number | null
          source_score?: number | null
          variance_score?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_price_confidence_master_item_id_fkey"
            columns: ["master_item_id"]
            isOneToOne: false
            referencedRelation: "v2_master_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_price_confidence_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_price_history: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          job_id: string | null
          master_item_id: string
          notes: string | null
          quantity: number | null
          source_id: string | null
          source_type: string
          unit: string
          unit_price: number
          vendor_id: string
        }
        Insert: {
          captured_at?: string
          created_at?: string
          id?: string
          job_id?: string | null
          master_item_id: string
          notes?: string | null
          quantity?: number | null
          source_id?: string | null
          source_type: string
          unit: string
          unit_price: number
          vendor_id: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          job_id?: string | null
          master_item_id?: string
          notes?: string | null
          quantity?: number | null
          source_id?: string | null
          source_type?: string
          unit?: string
          unit_price?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_price_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_price_history_master_item_id_fkey"
            columns: ["master_item_id"]
            isOneToOne: false
            referencedRelation: "v2_master_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_price_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_sub_performance: {
        Row: {
          avg_budget_variance: number | null
          created_at: string
          id: string
          jobs_bid: number | null
          jobs_completed: number | null
          jobs_won: number | null
          labor_category_id: string | null
          last_evaluated: string | null
          notes: string | null
          on_time_rate: number | null
          quality_score: number | null
          updated_at: string
          vendor_id: string
          win_rate: number | null
        }
        Insert: {
          avg_budget_variance?: number | null
          created_at?: string
          id?: string
          jobs_bid?: number | null
          jobs_completed?: number | null
          jobs_won?: number | null
          labor_category_id?: string | null
          last_evaluated?: string | null
          notes?: string | null
          on_time_rate?: number | null
          quality_score?: number | null
          updated_at?: string
          vendor_id: string
          win_rate?: number | null
        }
        Update: {
          avg_budget_variance?: number | null
          created_at?: string
          id?: string
          jobs_bid?: number | null
          jobs_completed?: number | null
          jobs_won?: number | null
          labor_category_id?: string | null
          last_evaluated?: string | null
          notes?: string | null
          on_time_rate?: number | null
          quality_score?: number | null
          updated_at?: string
          vendor_id?: string
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_sub_performance_labor_category_id_fkey"
            columns: ["labor_category_id"]
            isOneToOne: false
            referencedRelation: "v2_labor_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_sub_performance_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_vendor_item_aliases: {
        Row: {
          created_at: string
          id: string
          master_item_id: string
          unit_conversion_factor: number | null
          updated_at: string
          vendor_description: string
          vendor_id: string
          vendor_sku: string | null
          vendor_unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          master_item_id: string
          unit_conversion_factor?: number | null
          updated_at?: string
          vendor_description: string
          vendor_id: string
          vendor_sku?: string | null
          vendor_unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          master_item_id?: string
          unit_conversion_factor?: number | null
          updated_at?: string
          vendor_description?: string
          vendor_id?: string
          vendor_sku?: string | null
          vendor_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_vendor_item_aliases_master_item_id_fkey"
            columns: ["master_item_id"]
            isOneToOne: false
            referencedRelation: "v2_master_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_vendor_item_aliases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_aliases: {
        Row: {
          alias_name: string
          created_at: string | null
          id: string
          source: string | null
          updated_at: string | null
          use_count: number | null
          vendor_id: string
        }
        Insert: {
          alias_name: string
          created_at?: string | null
          id?: string
          source?: string | null
          updated_at?: string | null
          use_count?: number | null
          vendor_id: string
        }
        Update: {
          alias_name?: string
          created_at?: string | null
          id?: string
          source?: string | null
          updated_at?: string | null
          use_count?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_aliases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          insurance_expiry: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string
          tax_id: string | null
          trade_type: string | null
          updated_at: string
          w9_on_file: boolean | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          insurance_expiry?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          tax_id?: string | null
          trade_type?: string | null
          updated_at?: string
          w9_on_file?: boolean | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          insurance_expiry?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          tax_id?: string | null
          trade_type?: string | null
          updated_at?: string
          w9_on_file?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
