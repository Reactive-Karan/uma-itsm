// Manually crafted types for Sprint 1.
// In production: run `supabase gen types typescript --project-id <id>` to auto-generate.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'requester' | 'dept_user' | 'manager' | 'super_admin'
export type RequestType = 'it_service' | 'data_service'
export type SubType = 'hardware' | 'software' | 'analysis' | 'discrepancy' | 'issues'
export type Priority = 'high' | 'medium' | 'low'
export type TicketStatus =
  | 'new'
  | 'acknowledged'
  | 'in_progress'
  | 'pending_requester'
  | 'escalated'
  | 'resolved'
  | 'closed'
export type NotificationStatus = 'pending' | 'sent' | 'failed'
export type EscalationReason =
  | 'ack_sla_miss'
  | 'res_sla_miss'
  | 'manager_inaction'
  | 'loop_detected'

// Supabase v2 requires Relationships on each table and CompositeTypes on the schema.
export interface Database {
  public: {
    Tables: {
      regions: {
        Row: {
          id: string
          name: string
          code: string
          timezone: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          timezone: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          timezone?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          name: string
          code: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          created_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          auth_id: string
          email: string
          full_name: string
          role: UserRole
          region_id: string | null
          department_id: string | null
          is_ooo: boolean
          ooo_start_date: string | null
          ooo_end_date: string | null
          ooo_backup_user_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_id: string
          email: string
          full_name: string
          role?: UserRole
          region_id?: string | null
          department_id?: string | null
          is_ooo?: boolean
          ooo_start_date?: string | null
          ooo_end_date?: string | null
          ooo_backup_user_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_id?: string
          email?: string
          full_name?: string
          role?: UserRole
          region_id?: string | null
          department_id?: string | null
          is_ooo?: boolean
          ooo_start_date?: string | null
          ooo_end_date?: string | null
          ooo_backup_user_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'users_region_fk'
            columns: ['region_id']
            isOneToOne: false
            referencedRelation: 'regions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'users_dept_fk'
            columns: ['department_id']
            isOneToOne: false
            referencedRelation: 'departments'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      fn_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: UserRole
      }
      fn_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      user_role: UserRole
      request_type: RequestType
      sub_type: SubType
      priority: Priority
      ticket_status: TicketStatus
      notification_status: NotificationStatus
      escalation_reason: EscalationReason
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
